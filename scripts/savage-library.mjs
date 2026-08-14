#!/usr/bin/env node

import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { upload } from "@vercel/blob/client";
import {
  isFinalizedRelease,
  isPublisherToken,
  publisherUploadError,
} from "./publisher-upload-errors.mjs";

const command = process.argv[2];
const cwd = process.cwd();
const configPath = join(cwd, ".savage-library.json");
const PRODUCTION_ORIGIN = "https://savage-library.vercel.app";

if (!command || ["help", "--help", "-h"].includes(command)) {
  usage();
  process.exit(0);
}

const result = packageModule(cwd);

if (command === "login" || command === "link") {
  const site = option("--site");
  const resourceId = option("--resource");
  const token = option("--token") ?? process.env.SAVAGE_LIBRARY_TOKEN;
  if (!site || !resourceId || !token) {
    fail("link requires --site, --resource, and --token (or SAVAGE_LIBRARY_TOKEN).");
  }
  if (normalizeSite(site) !== PRODUCTION_ORIGIN) {
    fail(`--site must be ${PRODUCTION_ORIGIN}; preview and development deployments are not supported.`);
  }
  if (!isPublisherToken(token)) {
    fail("The publisher token is malformed. Use the one-time slp_ token from this module resource; do not use a Vercel Blob token.");
  }
  let verified;
  try {
    verified = await publisherRequest(`${PRODUCTION_ORIGIN}/api/publisher/verify`, token, {
      resourceId,
      moduleId: result.manifest.id,
      version: result.manifest.version,
      checksum: result.checksum,
      sizeBytes: result.bytes.length,
    });
  } catch (error) {
    fail(publisherUploadError(error));
  }
  const expectedSlug = distributionSlug(result.manifest);
  if (verified.resource.slug !== expectedSlug) {
    fail(`The resource slug is "${verified.resource.slug}", but module.json uses "${expectedSlug}".`);
  }
  const config = {
    site: PRODUCTION_ORIGIN,
    resourceId,
    token,
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  console.log(`Verified ${verified.resource.title} (${verified.resource.moduleId}).`);
  console.log(`Linked ${cwd} to Savage Library resource ${resourceId}.`);
  process.exit(0);
}

if (command === "validate") {
  console.log(`Valid ${result.manifest.title} v${result.manifest.version}`);
  console.log(`Module: ${result.manifest.id}`);
  console.log(`Archive: ${(result.bytes.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`SHA-256: ${result.checksum}`);
} else if (command === "release") {
  if (!existsSync(configPath)) fail("Run savage-library link first.");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const token = process.env.SAVAGE_LIBRARY_TOKEN ?? config.token;
  if (!config.site || !config.resourceId || !token) fail("Publisher configuration is incomplete.");
  if (normalizeSite(config.site) !== PRODUCTION_ORIGIN) {
    fail(`Relink this module with --site ${PRODUCTION_ORIGIN}; preview and development deployments are not supported.`);
  }
  if (!isPublisherToken(token)) {
    fail("The saved publisher token is malformed. Rotate the module token and run link again; do not use a Vercel Blob token.");
  }
  let verified;
  try {
    verified = await publisherRequest(`${config.site}/api/publisher/verify`, token, {
      resourceId: config.resourceId,
      moduleId: result.manifest.id,
      version: result.manifest.version,
      checksum: result.checksum,
      sizeBytes: result.bytes.length,
    });
  } catch (error) {
    fail(publisherUploadError(error));
  }
  const expectedSlug = distributionSlug(result.manifest);
  if (verified.resource.slug !== expectedSlug) {
    fail(`The linked resource slug is "${verified.resource.slug}", but module.json uses "${expectedSlug}".`);
  }
  console.log(`Publisher verified for ${verified.resource.title}; private storage is ready.`);
  const fileName = `${result.manifest.id}-${result.manifest.version}.zip`;
  const file = new File([result.bytes], fileName, { type: "application/zip" });
  console.log(`Uploading ${result.manifest.id} v${result.manifest.version}…`);
  try {
    await upload(
      `foundry-release-uploads/${config.resourceId}/${Date.now()}-${fileName}`,
      file,
      {
        access: "private",
        handleUploadUrl: `${config.site}/api/publisher/uploads`,
        multipart: file.size > 20 * 1024 * 1024,
        headers: { Authorization: `Bearer ${token}` },
        clientPayload: JSON.stringify({
          resourceId: config.resourceId,
          originalName: fileName,
          sizeBytes: file.size,
          source: "cli",
          uploadedBy: "publisher-cli",
        }),
      },
    );
  } catch (error) {
    try {
      await publisherRequest(`${config.site}/api/publisher/verify`, token, {
        resourceId: config.resourceId,
        moduleId: result.manifest.id,
        version: result.manifest.version,
        checksum: result.checksum,
        sizeBytes: result.bytes.length,
      });
    } catch (diagnosticError) {
      fail(publisherUploadError(diagnosticError));
    }
    fail(`The direct Blob upload failed after publisher authentication and storage checks passed. ${publisherUploadError(error)}`);
  }
  const status = await waitForDraft(config.site, token, {
    resourceId: config.resourceId,
    moduleId: result.manifest.id,
    version: result.manifest.version,
    checksum: result.checksum,
  });
  if (!status.release) fail("The upload completed, but Savage Library did not create the release draft.");
  if (status.release.checksum !== result.checksum) fail("The created release draft checksum does not match the uploaded archive.");
  if (status.release.status === "failed" || status.release.errors?.length) {
    fail(`Savage Library created a failed release: ${(status.release.errors ?? []).join("; ")}`);
  }
  console.log("Release uploaded as a draft.");
  console.log(`${config.site}/admin/resources/${config.resourceId}#module-releases`);
} else {
  fail(`Unknown command "${command}".`);
}

function packageModule(directory) {
  const manifestPath = join(directory, "module.json");
  if (!existsSync(manifestPath)) fail("module.json was not found in the current directory.");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    fail("module.json is not valid JSON.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id ?? "")) fail("module.json has an invalid id.");
  if (!manifest.title?.trim()) fail("module.json is missing title.");
  if (!manifest.description?.trim()) fail("module.json is missing description.");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(manifest.version ?? "")) {
    fail("module.json version must be semantic, for example 1.2.0.");
  }
  validateDistributionUrls(manifest);

  const ignored = new Set([
    ".git",
    ".next",
    "node_modules",
    ".savage-library.json",
    ".savageignore",
    `${manifest.id}.zip`,
    `${manifest.id}-${manifest.version}.zip`,
    ...readIgnore(directory),
  ]);
  const zip = new AdmZip();
  zip.addLocalFolder(directory, manifest.id, (path) => {
    const relative = path.replaceAll("\\", "/").replace(/^\.\//, "");
    return ![...ignored].some(
      (entry) =>
        relative === entry ||
        relative.endsWith(`/${entry}`) ||
        relative.startsWith(`${entry}/`) ||
        relative.includes(`/${entry}/`),
    );
  });
  const bytes = zip.toBuffer();
  return {
    manifest,
    bytes,
    checksum: createHash("sha256").update(bytes).digest("hex"),
  };
}

function validateDistributionUrls(manifest) {
  let page;
  let updater;
  try {
    page = new URL(manifest.url);
    updater = new URL(manifest.manifest);
  } catch {
    fail("module.json url and manifest must be valid HTTPS Savage Library URLs.");
  }
  if (page.origin !== PRODUCTION_ORIGIN || updater.origin !== PRODUCTION_ORIGIN) {
    fail(`module.json url and manifest must use ${PRODUCTION_ORIGIN}, never a preview or development deployment.`);
  }
  const pageMatch = page.pathname.match(/^\/resources\/([^/]+)$/);
  const updaterMatch = updater.pathname.match(/^\/api\/foundry\/modules\/([^/]+)\/module\.json$/);
  if (!pageMatch || !updaterMatch || pageMatch[1] !== updaterMatch[1]) {
    fail("module.json url and manifest must use the same exact Savage Library resource slug.");
  }
}

function distributionSlug(manifest) {
  return new URL(manifest.manifest).pathname.split("/").at(-2);
}

async function publisherRequest(url, token, body) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`network_error: ${error instanceof Error ? error.message : "request failed"}`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(`${payload.code ?? `http_${response.status}`}: ${payload.error ?? response.statusText}`);
  }
  return payload;
}

async function waitForDraft(site, token, metadata) {
  let latest;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    latest = await publisherRequest(`${site}/api/publisher/releases/status`, token, metadata);
    if (isFinalizedRelease(latest.release)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return latest;
}

function normalizeSite(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function readIgnore(directory) {
  const path = join(directory, ".savageignore");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\/|\/$/g, ""))
    .filter((line) => line && !line.startsWith("#") && !line.includes("*"));
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage() {
  console.log(`Savage Library module publisher

Commands:
  savage-library link --site URL --resource ID --token TOKEN
  savage-library validate
  savage-library release

Run validate and release from the module directory containing module.json.
Use .savageignore for additional directory or file names to exclude.`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
