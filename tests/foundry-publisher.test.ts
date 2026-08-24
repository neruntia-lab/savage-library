import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AdmZip from "adm-zip";
import {
  inspectFoundryModule,
  publicManifest,
  sha256Hex,
} from "../lib/foundry/publisher";
import {
  isFinalizedRelease,
  isPublisherToken,
  publisherUploadError,
} from "../scripts/publisher-upload-errors.mjs";
import {
  createPublisherConfig,
  distributionUrls,
  inferSystem,
  isAdminToken,
  validatePublisherConfig,
} from "../scripts/publisher-config.mjs";
import {
  parseReleaseNotes,
  serializeReleaseNotes,
  validateReleaseNotes,
} from "../lib/validation/release-notes";
import { formatLongDate } from "../lib/format";

test("creates deterministic tracked catalog metadata and production URLs", () => {
  const manifest = {
    id: "example-module",
    title: "Example Module",
    description: "<p>A useful module.</p>",
    relationships: { systems: [{ id: "dnd5e" }] },
    url: "https://example.com/source",
  };
  const config = createPublisherConfig(manifest);
  assert.equal(config.resource.system, "dnd5e");
  assert.equal(config.resource.projectUrl, manifest.url);
  assert.deepEqual(validatePublisherConfig(config), []);
  assert.deepEqual(distributionUrls("example-module"), {
    url: "https://savage-library.vercel.app/resources/example-module",
    manifest: "https://savage-library.vercel.app/api/foundry/modules/example-module/module.json",
  });
});

test("admin token validation and system inference fail safely", () => {
  assert.equal(isAdminToken(`sla_${"a".repeat(64)}`), true);
  assert.equal(isAdminToken(`slp_${"a".repeat(64)}`), false);
  assert.equal(inferSystem({ relationships: { systems: [{ id: "a" }, { id: "b" }] } }), "system-agnostic");
  assert.ok(validatePublisherConfig({ schemaVersion: 1, resource: {} }).length > 0);
});

test("requires concise release notes for existing module updates", () => {
  const valid = {
    version: "3.10.0",
    changes: ["Added playlist synchronization.", "Fixed scene audio playback."],
  };
  assert.equal(validateReleaseNotes(valid, "3.10.0").success, true);
  const config = createPublisherConfig({ id: "example", title: "Example", description: "Example module." });
  assert.deepEqual(validatePublisherConfig(config, "1.0.0", false), []);
  assert.ok(validatePublisherConfig(config, "1.0.0", true).some((error) => error.includes("required")));
  assert.ok(validatePublisherConfig({ ...config, release: { ...valid, version: "3.9.0" } }, "3.10.0", true).some((error) => error.includes("must match")));
});

test("rejects empty, duplicate, long, and indirect patch notes", () => {
  const result = validateReleaseNotes({
    version: "2.0.0",
    changes: [
      "",
      "Fixed audio playback.",
      "Fixed audio playback.",
      `Added ${"x".repeat(170)}.`,
      "Refactored the audio service.",
    ],
  }, "2.0.0");
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.errors.some((error) => error.includes("empty")));
    assert.ok(result.errors.some((error) => error.includes("duplicates")));
    assert.ok(result.errors.some((error) => error.includes("160")));
    assert.ok(result.errors.some((error) => error.includes("must begin")));
  }
});

test("serializes and parses structured patch notes without changing legacy entries", () => {
  const details = serializeReleaseNotes(["Added a new control.", "Improved mobile playback."]);
  assert.deepEqual(parseReleaseNotes("Patch notes", details), ["Added a new control.", "Improved mobile playback."]);
  assert.equal(parseReleaseNotes("Compatibility update", details), null);
  assert.equal(formatLongDate("2026-08-24T12:00:00.000Z"), "August 24, 2026");
});

test("CLI init creates tracked metadata, stable URLs, and a secret ignore rule", () => {
  const directory = mkdtempSync(join(tmpdir(), "savage-cli-"));
  try {
    writeFileSync(join(directory, "module.json"), JSON.stringify({
      id: "cli-example",
      title: "CLI Example",
      description: "A complete CLI test module.",
      version: "1.0.0",
      url: "https://example.com/project",
    }));
    execFileSync(process.execPath, [join(process.cwd(), "scripts/savage-library.mjs"), "init"], { cwd: directory });
    const manifest = JSON.parse(readFileSync(join(directory, "module.json"), "utf8"));
    const config = JSON.parse(readFileSync(join(directory, "savage-library.json"), "utf8"));
    assert.equal(manifest.manifest, "https://savage-library.vercel.app/api/foundry/modules/cli-example/module.json");
    assert.equal(config.resource.projectUrl, "https://example.com/project");
    assert.match(readFileSync(join(directory, ".gitignore"), "utf8"), /^\.savage-library\.json$/m);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function moduleZip(
  manifest: Record<string, unknown>,
  folder = String(manifest.id),
) {
  const zip = new AdmZip();
  zip.addFile(
    `${folder}/module.json`,
    Buffer.from(
      JSON.stringify({
        description: "Test module description.",
        ...manifest,
      }),
    ),
  );
  zip.addFile(`${folder}/scripts/main.js`, Buffer.from("export {};"));
  return zip.toBuffer();
}

test("validates and extracts a Foundry module package", () => {
  const result = inspectFoundryModule(
    moduleZip({
      id: "savage-craft",
      title: "Savage Craft",
      version: "1.2.0",
      compatibility: { minimum: "12", verified: "13" },
    }),
    "savage-craft",
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest?.version, "1.2.0");
});

test("rejects mismatched folders and module identifiers", () => {
  const result = inspectFoundryModule(
    moduleZip(
      { id: "wrong-module", title: "Wrong", version: "1.0.0" },
      "another-folder",
    ),
    "expected-module",
  );
  assert.ok(result.errors.some((error) => error.includes("top-level")));
  assert.ok(result.errors.some((error) => error.includes("expected-module")));
});

test("rejects a manifest without Foundry's required description", () => {
  const result = inspectFoundryModule(
    moduleZip({
      id: "missing-description",
      title: "Missing Description",
      description: "",
      version: "1.0.0",
    }),
  );

  assert.ok(result.errors.some((error) => error.includes("description")));
});

test("rejects unsafe ZIP paths", () => {
  const zip = new AdmZip();
  zip.addFile("C:/escape.txt", Buffer.from("unsafe"));
  zip.addFile(
    "safe-module/module.json",
    Buffer.from(JSON.stringify({ id: "safe-module", title: "Safe", version: "1.0.0" })),
  );
  const result = inspectFoundryModule(zip.toBuffer());
  assert.ok(result.errors.some((error) => error.includes("Unsafe archive path")));
});

test("rejects files outside the module top-level directory", () => {
  const zip = new AdmZip();
  zip.addFile(
    "safe-module/module.json",
    Buffer.from(
      JSON.stringify({
        id: "safe-module",
        title: "Safe",
        version: "1.0.0",
      }),
    ),
  );
  zip.addFile("unrelated/readme.txt", Buffer.from("not part of the module"));
  const result = inspectFoundryModule(zip.toBuffer());
  assert.ok(
    result.errors.some((error) =>
      error.includes("only the module's top-level directory"),
    ),
  );
});

test("rejects publisher credentials, environment files, and nested archives", () => {
  const zip = new AdmZip();
  zip.addFile(
    "safe-module/module.json",
    Buffer.from(
      JSON.stringify({
        id: "safe-module",
        title: "Safe",
        version: "1.0.0",
      }),
    ),
  );
  zip.addFile("safe-module/.savage-library.json", Buffer.from("secret"));
  zip.addFile("safe-module/.env.local", Buffer.from("secret"));
  zip.addFile("safe-module/safe-module.zip", Buffer.from("nested"));

  const result = inspectFoundryModule(zip.toBuffer());

  assert.ok(result.errors.some((error) => error.includes("Publisher credentials")));
  assert.ok(result.errors.some((error) => error.includes("Nested ZIP")));
});

test("generates stable site manifest and version-specific download", () => {
  const result = publicManifest(
    {
      id: "savage-craft",
      title: "Savage Craft",
      description: "A crafting module.",
      version: "2.0.0",
      manifest: "https://untrusted.example/module.json",
      download: "https://untrusted.example/module.zip",
    },
    {
      baseUrl: "https://library.example",
      slug: "savage-craft",
      versionId: "release-id",
      authorName: "Neruntia Lab",
    },
  );
  assert.equal(
    result.manifest,
    "https://library.example/api/foundry/modules/savage-craft/module.json",
  );
  assert.equal(
    result.download,
    "https://library.example/api/foundry/modules/savage-craft/releases/release-id/module.zip",
  );
  assert.deepEqual(result.authors, [{ name: "Neruntia Lab" }]);
});

test("fills required public manifest metadata from the catalog", () => {
  const result = publicManifest(
    {
      id: "savage-sounds",
      title: "Savage Sounds",
      version: "3.9.3",
    },
    {
      baseUrl: "https://library.example",
      slug: "savage-sounds",
      versionId: "release-id",
      description: "Sound management for Foundry VTT.",
      authorName: "Neruntia Lab",
    },
  );

  assert.equal(result.description, "Sound management for Foundry VTT.");
  assert.deepEqual(result.authors, [{ name: "Neruntia Lab" }]);
});

test("SHA-256 output is deterministic", async () => {
  assert.equal(
    await sha256Hex(new TextEncoder().encode("Savage Library")),
    "c25fbc6f2c417a2defa328cbdef32ef93535b95a6bb2253c187762e4e9c3d372",
  );
});

test("publisher upload errors distinguish authentication and storage failures", () => {
  assert.match(
    publisherUploadError(new Error("Publisher token rejected.")),
    /authentication was rejected/i,
  );
  assert.match(
    publisherUploadError(new Error("Private module storage is unavailable.")),
    /private module storage is unavailable/i,
  );
  assert.match(
    publisherUploadError(new Error("fetch failed")),
    /network connection/i,
  );
  assert.match(
    publisherUploadError(new Error("module_resource_mismatch")),
    /different Foundry module/i,
  );
  assert.match(
    publisherUploadError(new Error("version_conflict")),
    /new semantic version/i,
  );
  assert.match(
    publisherUploadError(new Error("Vercel Blob: Failed to retrieve the client token")),
    /preflight passed/i,
  );
});

test("publisher token format rejects Blob credentials and malformed values", () => {
  assert.equal(isPublisherToken(`slp_${"a".repeat(64)}`), true);
  assert.equal(isPublisherToken("vercel_blob_rw_example"), false);
  assert.equal(isPublisherToken("slp_too-short"), false);
});

test("release confirmation waits for the Blob callback checksum", () => {
  assert.equal(isFinalizedRelease({ status: "draft", checksum: null }), false);
  assert.equal(isFinalizedRelease({ status: "draft", checksum: "abc123" }), true);
});
