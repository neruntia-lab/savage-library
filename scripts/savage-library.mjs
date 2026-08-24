#!/usr/bin/env node
import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import process from "node:process";
import { upload } from "@vercel/blob/client";
import { isFinalizedRelease, isPublisherToken, publisherUploadError } from "./publisher-upload-errors.mjs";
import { CONFIG_FILE, LINK_FILE, PRODUCTION_ORIGIN, createPublisherConfig, distributionUrls, isAdminToken, validatePublisherConfig } from "./publisher-config.mjs";

const command = process.argv[2];
const cwd = process.cwd();
const linkPath = join(cwd, LINK_FILE);
const catalogPath = join(cwd, CONFIG_FILE);
if (!command || ["help", "--help", "-h"].includes(command)) { usage(); process.exit(0); }
if (command === "login") { await login(); process.exit(0); }
if (command === "logout") { logout(); process.exit(0); }
const manifestPath = join(cwd, "module.json");
const manifest = readManifest(manifestPath, command !== "init");
if (command === "init") { initialize(manifest, manifestPath); process.exit(0); }
if (command === "link") { await legacyLink(manifest); process.exit(0); }
const catalog = readCatalogConfig();
if (distributionSlug(manifest) !== catalog.resource.slug) fail(`module.json distribution URLs must use resource slug "${catalog.resource.slug}".`);
const result = packageModule(cwd, manifest);
if (command === "validate") { printValidation(result, catalog); process.exit(0); }
if (command !== "release") fail(`Unknown command "${command}".`);
await release(result, catalog, process.argv.includes("--publish"));

async function login() {
  const token = option("--token") ?? process.env.SAVAGE_LIBRARY_ADMIN_TOKEN;
  if (!isAdminToken(token)) fail("login requires a valid sla_ administrator token from Admin > CLI Access.");
  try { const body = await apiRequest(`${PRODUCTION_ORIGIN}/api/publisher/admin/verify`, token, {}); saveCredential(token); console.log(`Signed in as ${body.credential.name}.`); }
  catch (error) { fail(cliError(error)); }
}
function logout() { const path = credentialPath(); if (existsSync(path)) rmSync(path); console.log("Savage Library CLI administrator credential removed from this computer."); }
function initialize(moduleManifest, path) {
  if (existsSync(catalogPath) && !process.argv.includes("--force")) fail(`${CONFIG_FILE} already exists. Use init --force to replace it.`);
  const config = createPublisherConfig(moduleManifest);
  writeFileSync(catalogPath, `${JSON.stringify(config, null, 2)}\n`);
  const urls = distributionUrls(config.resource.slug);
  const nextManifest = { ...moduleManifest, ...urls }; delete nextManifest.download;
  writeFileSync(path, `${JSON.stringify(nextManifest, null, 2)}\n`);
  ensureSecretIgnored();
  console.log(`Created ${CONFIG_FILE} and configured stable production URLs in module.json.`);
  console.log("Review the tracked catalog metadata, then run validate and release.");
}
function ensureSecretIgnored() { const path = join(cwd, ".gitignore"); const existing = existsSync(path) ? readFileSync(path, "utf8") : ""; if (!existing.split(/\r?\n/).includes(LINK_FILE)) writeFileSync(path, `${existing}${existing && !existing.endsWith("\n") ? "\n" : ""}${LINK_FILE}\n`); }
async function release(result, catalog, publish) {
  let link = readJson(linkPath, null);
  const adminToken = process.env.SAVAGE_LIBRARY_ADMIN_TOKEN ?? readCredential();
  let catalogResource;
  if (adminToken) {
    if (!isAdminToken(adminToken)) fail("The saved administrator credential is malformed. Run logout, then login with a new token.");
    let synced;
    try { synced = await apiRequest(`${PRODUCTION_ORIGIN}/api/publisher/catalog`, adminToken, { module: result.manifest, resource: catalog.resource, release: catalog.release, expectedRevision: link?.revision, needsPublisherToken: !link?.token || link.moduleId !== result.manifest.id }); }
    catch (error) { fail(cliError(error)); }
    const resource = synced.resource;
    catalogResource = resource;
    link = { site: PRODUCTION_ORIGIN, resourceId: resource.resourceId, moduleId: result.manifest.id, revision: resource.revision, token: resource.publisherToken ?? link?.token };
    if (!link.token) fail("Catalog synchronization succeeded but no module upload token is available. Remove .savage-library.json and retry.");
    writeFileSync(linkPath, `${JSON.stringify(link, null, 2)}\n`, { mode: 0o600 });
    console.log(resource.created ? `Created catalog draft ${resource.title}.` : `Synchronized catalog metadata for ${resource.title}.`);
  } else if (publish) fail("release --publish requires an administrator login. Run login first.");
  const token = process.env.SAVAGE_LIBRARY_TOKEN ?? link?.token;
  if (!link?.resourceId || !isPublisherToken(token)) fail("No valid module upload credential is available. Run login, then release; or use the legacy link command.");
  let verified;
  try { verified = await apiRequest(`${PRODUCTION_ORIGIN}/api/publisher/verify`, token, metadata(link.resourceId, result)); }
  catch (error) { fail(publisherUploadError(error)); }
  if (!adminToken && verified.resource.hasActiveRelease) fail("Existing module updates require an administrator login so patch notes can be saved. Run login first.");
  if (verified.resource.slug !== catalog.resource.slug) fail(`The linked resource slug is "${verified.resource.slug}", but ${CONFIG_FILE} uses "${catalog.resource.slug}".`);
  console.log(`Publisher verified for ${verified.resource.title}; private storage is ready.`);
  const fileName = `${result.manifest.id}-${result.manifest.version}.zip`;
  const file = new File([result.bytes], fileName, { type: "application/zip" });
  console.log(`Uploading ${result.manifest.id} v${result.manifest.version}…`);
  try { await upload(`foundry-release-uploads/${link.resourceId}/${Date.now()}-${fileName}`, file, { access: "private", handleUploadUrl: `${PRODUCTION_ORIGIN}/api/publisher/uploads`, multipart: file.size > 20 * 1024 * 1024, headers: { Authorization: `Bearer ${token}` }, clientPayload: JSON.stringify({ resourceId: link.resourceId, originalName: fileName, sizeBytes: file.size, source: "cli", uploadedBy: "publisher-cli" }) }); }
  catch (error) { fail(`The direct Blob upload failed. ${publisherUploadError(error)}`); }
  const status = await waitForDraft(token, metadata(link.resourceId, result));
  if (!status.release || status.release.checksum !== result.checksum) fail("Savage Library did not confirm a matching release draft.");
  if (status.release.status === "failed" || status.release.errors?.length) fail(`Savage Library created a failed release: ${(status.release.errors ?? []).join("; ")}`);
  if (catalogResource?.requiresPatchNotes || catalog.release) {
    try {
      await apiRequest(`${PRODUCTION_ORIGIN}/api/publisher/catalog/release-notes`, adminToken, {
        resourceId: link.resourceId,
        releaseId: status.release.id,
        version: result.manifest.version,
        release: catalog.release,
      });
    } catch (error) {
      fail(`The release draft was uploaded, but its required patch notes could not be saved. ${cliError(error)}`);
    }
  }
  console.log(`Release ${result.manifest.version} uploaded as a draft.`);
  if (catalog.release?.changes?.length) printPatchNotes(result.manifest.version, catalog.release.changes);
  console.log(`${PRODUCTION_ORIGIN}/admin/resources/${link.resourceId}#module-releases`);
  if (publish) {
    let published;
    try { published = await apiRequest(`${PRODUCTION_ORIGIN}/api/publisher/catalog/publish`, adminToken, { resourceId: link.resourceId, releaseId: status.release.id }); }
    catch (error) { fail(cliError(error)); }
    await verifyPublished(result, published.manifestUrl);
    console.log(`Published ${result.manifest.title} v${result.manifest.version}.`);
    console.log(published.manifestUrl);
  }
}
function readManifest(path, validateUrls) {
  if (!existsSync(path)) fail("module.json was not found in the current directory.");
  let value; try { value = JSON.parse(readFileSync(path, "utf8")); } catch { fail("module.json is not valid JSON."); }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id ?? "")) fail("module.json has an invalid id.");
  if (!value.title?.trim() || !value.description?.trim()) fail("module.json requires title and description.");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value.version ?? "")) fail("module.json version must be semantic, for example 1.2.0.");
  if (validateUrls) validateDistributionUrls(value);
  return value;
}
function readCatalogConfig() { if (!existsSync(catalogPath)) fail(`Run savage-library init first, then review ${CONFIG_FILE}.`); const value = readJson(catalogPath, null); const errors = validatePublisherConfig(value, manifest.version); if (errors.length) fail(errors.join(" ")); return value; }
function packageModule(directory, moduleManifest) {
  const ignored = new Set([".git", ".next", "node_modules", LINK_FILE, CONFIG_FILE, ".savageignore", `${moduleManifest.id}.zip`, `${moduleManifest.id}-${moduleManifest.version}.zip`, ...readIgnore(directory)]);
  const zip = new AdmZip(); zip.addLocalFolder(directory, moduleManifest.id, (path) => { const relative = path.replaceAll("\\", "/").replace(/^\.\//, ""); return ![...ignored].some((entry) => relative === entry || relative.endsWith(`/${entry}`) || relative.startsWith(`${entry}/`) || relative.includes(`/${entry}/`)); });
  const bytes = zip.toBuffer(); return { manifest: moduleManifest, bytes, checksum: createHash("sha256").update(bytes).digest("hex") };
}
function validateDistributionUrls(value) { let page; let updater; try { page = new URL(value.url); updater = new URL(value.manifest); } catch { fail("module.json url and manifest must be valid Savage Library production URLs."); } const pageMatch = page.pathname.match(/^\/resources\/([^/]+)$/); const updaterMatch = updater.pathname.match(/^\/api\/foundry\/modules\/([^/]+)\/module\.json$/); if (page.origin !== PRODUCTION_ORIGIN || updater.origin !== PRODUCTION_ORIGIN || !pageMatch || !updaterMatch || pageMatch[1] !== updaterMatch[1]) fail("module.json url and manifest must use the same stable savage-library.vercel.app resource slug."); }
function distributionSlug(value) { return new URL(value.manifest).pathname.split("/").at(-2); }
function printValidation(result, catalog) { console.log(`Valid ${result.manifest.title} v${result.manifest.version}`); console.log(`Catalog: ${catalog.resource.slug}`); console.log(`Archive: ${(result.bytes.length / 1024 / 1024).toFixed(2)} MB`); console.log(`SHA-256: ${result.checksum}`); if (catalog.release?.changes?.length) printPatchNotes(result.manifest.version, catalog.release.changes); }
function printPatchNotes(version, changes) { console.log(`Patch notes for v${version}:`); changes.forEach((change) => console.log(`- ${change}`)); }
async function legacyLink(moduleManifest) { const site = option("--site"); const resourceId = option("--resource"); const token = option("--token") ?? process.env.SAVAGE_LIBRARY_TOKEN; if (!site || !resourceId || !isPublisherToken(token) || new URL(site).origin !== PRODUCTION_ORIGIN) fail(`link requires --site ${PRODUCTION_ORIGIN}, --resource ID, and a valid slp_ token.`); const result = packageModule(cwd, moduleManifest); const verified = await apiRequest(`${PRODUCTION_ORIGIN}/api/publisher/verify`, token, metadata(resourceId, result)); writeFileSync(linkPath, `${JSON.stringify({ site: PRODUCTION_ORIGIN, resourceId, moduleId: moduleManifest.id, token }, null, 2)}\n`, { mode: 0o600 }); console.log(`Linked ${verified.resource.title}.`); }
async function verifyPublished(result, manifestUrl) { const response = await fetch(manifestUrl, { cache: "no-store" }); const body = await response.json().catch(() => null); if (!response.ok || body?.id !== result.manifest.id || body?.version !== result.manifest.version || typeof body?.download !== "string") fail("Publication completed, but the stable manifest did not return the expected release."); const zipResponse = await fetch(body.download); if (!zipResponse.ok) fail("The published module download could not be retrieved."); const bytes = Buffer.from(await zipResponse.arrayBuffer()); if (createHash("sha256").update(bytes).digest("hex") !== result.checksum) fail("The published module checksum does not match the local archive."); const zip = new AdmZip(bytes); if (!zip.getEntry(`${result.manifest.id}/module.json`)) fail("The published ZIP does not contain the expected top-level module.json."); }
function metadata(resourceId, result) { return { resourceId, moduleId: result.manifest.id, version: result.manifest.version, checksum: result.checksum, sizeBytes: result.bytes.length }; }
async function apiRequest(url, token, body) { let response; try { response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); } catch (error) { throw new Error(`network_error: ${error instanceof Error ? error.message : "request failed"}`); } const payload = await response.json().catch(() => ({})); if (!response.ok || payload.ok === false) throw new Error(`${payload.code ?? `http_${response.status}`}: ${payload.error ?? response.statusText}`); return payload; }
async function waitForDraft(token, data) { let latest; for (let attempt = 0; attempt < 8; attempt += 1) { latest = await apiRequest(`${PRODUCTION_ORIGIN}/api/publisher/releases/status`, token, data); if (isFinalizedRelease(latest.release)) return latest; await new Promise((resolve) => setTimeout(resolve, 750)); } return latest; }
function cliError(error) { const message = error instanceof Error ? error.message : String(error); if (message.includes("admin_cli_token_invalid")) return "Administrator CLI authentication failed. Create a new token in Admin > CLI Access and run login again."; if (message.includes("scope_missing")) return "The administrator token lacks the required scope. Create a replacement token with the required permissions."; if (message.includes("taxonomy_not_found") || message.includes("resource_revision_conflict")) return message.split(": ").slice(1).join(": "); if (message.includes("network_error")) return `Savage Library could not be reached. ${message}`; return message; }
function credentialPath() { const root = process.platform === "win32" ? process.env.APPDATA || join(homedir(), "AppData", "Roaming") : process.env.XDG_CONFIG_HOME || join(homedir(), ".config"); return join(root, "Savage Library", "credentials.json"); }
function saveCredential(token) { const path = credentialPath(); mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); writeFileSync(path, `${JSON.stringify({ site: PRODUCTION_ORIGIN, token }, null, 2)}\n`, { mode: 0o600 }); }
function readCredential() { const value = readJson(credentialPath(), null); return value?.site === PRODUCTION_ORIGIN ? value.token : undefined; }
function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }
function readIgnore(directory) { const path = join(directory, ".savageignore"); if (!existsSync(path)) return []; return readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.trim().replace(/^\/|\/$/g, "")).filter((line) => line && !line.startsWith("#") && !line.includes("*")); }
function option(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function usage() { console.log(`Savage Library module publisher\n\nCommands:\n  savage-library login --token ADMIN_TOKEN\n  savage-library logout\n  savage-library init [--force]\n  savage-library validate\n  savage-library release [--publish]\n  savage-library link --site URL --resource ID --token TOKEN (legacy)\n\nRun init, validate, and release from a module directory containing module.json.\nCatalog metadata is stored in tracked ${CONFIG_FILE}; secrets are stored outside source control.`); }
function fail(message) { console.error(`Error: ${message}`); process.exit(1); }
