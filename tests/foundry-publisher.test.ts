import assert from "node:assert/strict";
import test from "node:test";
import AdmZip from "adm-zip";
import {
  inspectFoundryModule,
  publicManifest,
  sha256Hex,
} from "../lib/foundry/publisher";

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
