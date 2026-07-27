import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizePlainText,
  validateResourceInput,
} from "../lib/validation/resource";
import { MAX_UPLOAD_BYTES, validateUpload } from "../lib/validation/upload";
import {
  HERO_IMAGE_MAX_BYTES,
  validateHeroDimensions,
  validateHeroFileMetadata,
} from "../lib/validation/hero-image";

const validResource = {
  title: "Test Module",
  slug: "test-module",
  shortDescription: "A valid concise resource description.",
  description: "Plain text only.",
  resourceType: "module",
  categoryId: "category-foundry-modules",
  authorId: "author-neruntia-lab",
  gameSystemId: "system-dnd5e",
  currentVersion: "1.0.0",
  compatibilityStatus: "verified",
  pricing: "free",
  tagIds: ["tag-automation"],
  dependencies: [],
  isFeatured: false,
  isPublished: true,
};

test("resource validation accepts normalized production input", () => {
  const result = validateResourceInput(validResource);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.slug, "test-module");
    assert.deepEqual(result.data.tagIds, ["tag-automation"]);
  }
});

test("published Patreon resources require at least one entitled tier", () => {
  const result = validateResourceInput({
    ...validResource,
    accessMode: "patreon",
    patreonTierIds: [],
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.errors.patreonTierIds, /at least one Patreon tier/);
  }
});

test("resource validation rejects unsafe URLs and invalid slugs", () => {
  const result = validateResourceInput({
    ...validResource,
    slug: "../unsafe",
    manifestUrl: "javascript:alert(1)",
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.errors.slug, /lowercase/);
    assert.match(result.errors.manifestUrl, /HTTP/);
  }
});

test("plain-text sanitizer removes null bytes and normalizes line endings", () => {
  assert.equal(sanitizePlainText("  one\r\ntwo\u0000  "), "one\ntwo");
});

test("upload validation requires matching extension, MIME type, and size", () => {
  const valid = new File(["module"], "package.zip", {
    type: "application/zip",
  });
  assert.deepEqual(validateUpload(valid, "module"), {
    valid: true,
    extension: ".zip",
  });

  const disguised = new File(["bad"], "package.zip", {
    type: "application/pdf",
  });
  assert.equal(validateUpload(disguised, "module").valid, false);

  const oversized = {
    name: "large.pdf",
    type: "application/pdf",
    size: MAX_UPLOAD_BYTES + 1,
  } as File;
  assert.equal(validateUpload(oversized, "pdf").valid, false);
});

test("hero image validation accepts a suitable wide WebP", () => {
  assert.deepEqual(
    validateHeroFileMetadata({
      name: "archive.webp",
      type: "image/webp",
      size: 500_000,
    }),
    { valid: true },
  );
  assert.deepEqual(validateHeroDimensions(1877, 838), { valid: true });
});

test("hero image validation rejects unsafe files and crops", () => {
  assert.equal(
    validateHeroFileMetadata({
      name: "archive.svg",
      type: "image/svg+xml",
      size: 100,
    }).valid,
    false,
  );
  assert.equal(
    validateHeroFileMetadata({
      name: "huge.png",
      type: "image/png",
      size: HERO_IMAGE_MAX_BYTES + 1,
    }).valid,
    false,
  );
  assert.equal(validateHeroDimensions(900, 900).valid, false);
  assert.equal(validateHeroDimensions(4000, 600).valid, false);
});
