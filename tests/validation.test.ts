import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import test from "node:test";
import {
  sanitizePlainText,
  validateResourceInput,
  type ResourceInput,
} from "../lib/validation/resource";
import {
  MAX_DESCRIPTION_IMAGE_BYTES,
  MAX_UPLOAD_BYTES,
  validateUpload,
  validateUploadMetadata,
} from "../lib/validation/upload";
import {
  HERO_IMAGE_MAX_BYTES,
  validateHeroDimensions,
  validateHeroFileMetadata,
} from "../lib/validation/hero-image";
import { verifyScryptPassword } from "../lib/services/password";
import { resolveResourceArtwork } from "../lib/services/resource-artwork";
import {
  createWizardDraftInput,
  wizardContentChecks,
  wizardSlug,
  wizardStepErrors,
} from "../lib/services/resource-wizard";
import {
  taxonomyError,
  validateTaxonomy,
} from "../lib/validation/taxonomy";

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
    assert.equal(result.data.useIconEverywhere, false);
    assert.equal(
      result.data.manifestUrl,
      "https://savage-library.vercel.app/api/foundry/modules/test-module/module.json",
    );
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

test("description image validation accepts safe formats and enforces 10 MB", () => {
  assert.deepEqual(
    validateUploadMetadata({
      name: "preview.webp",
      type: "image/webp",
      size: 500_000,
      kind: "descriptionImage",
    }),
    { valid: true, extension: ".webp" },
  );
  assert.equal(
    validateUploadMetadata({
      name: "preview.svg",
      type: "image/svg+xml",
      size: 500_000,
      kind: "descriptionImage",
    }).valid,
    false,
  );
  assert.equal(
    validateUploadMetadata({
      name: "preview.png",
      type: "image/png",
      size: MAX_DESCRIPTION_IMAGE_BYTES + 1,
      kind: "descriptionImage",
    }).valid,
    false,
  );
});

test("resource validation preserves the icon-everywhere preference", () => {
  const result = validateResourceInput({
    ...validResource,
    useIconEverywhere: true,
  });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.useIconEverywhere, true);
});

test("resource artwork resolution restores dedicated images when override is off", () => {
  const artwork = {
    iconUrl: "https://example.com/icon.png",
    coverUrl: "https://example.com/cover.png",
    thumbnailUrl: "https://example.com/card.png",
  };
  assert.deepEqual(resolveResourceArtwork({ ...artwork, useIconEverywhere: false }), {
    heroArtworkUrl: artwork.iconUrl,
    cardArtworkUrl: artwork.thumbnailUrl,
  });
  assert.deepEqual(resolveResourceArtwork({ ...artwork, useIconEverywhere: true }), {
    heroArtworkUrl: artwork.iconUrl,
    cardArtworkUrl: artwork.iconUrl,
  });
  assert.deepEqual(resolveResourceArtwork({
    coverUrl: artwork.coverUrl,
    useIconEverywhere: true,
  }), {
    heroArtworkUrl: artwork.coverUrl,
    cardArtworkUrl: "/savage-library-logo.svg",
  });
});

test("resource icon validation accepts safe raster images and rejects SVG", () => {
  assert.deepEqual(
    validateUploadMetadata({
      name: "resource-icon.png",
      type: "image/png",
      size: 250_000,
      kind: "icon",
    }),
    { valid: true, extension: ".png" },
  );
  assert.equal(
    validateUploadMetadata({
      name: "resource-icon.svg",
      type: "image/svg+xml",
      size: 10_000,
      kind: "icon",
    }).valid,
    false,
  );
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

test("shared scrypt verifier accepts only the encoded password", () => {
  const salt = "preview-test-salt";
  const encoded = `scrypt$${salt}$${scryptSync(
    "correct horse",
    salt,
    64,
  ).toString("hex")}`;
  assert.equal(verifyScryptPassword("correct horse", encoded), true);
  assert.equal(verifyScryptPassword("wrong horse", encoded), false);
  assert.equal(verifyScryptPassword("correct horse", "invalid"), false);
});

test("taxonomy validation accepts canonical values and rejects unsafe slugs", async () => {
  assert.equal(
    validateTaxonomy({
      type: "tag",
      name: "Encounter Tools",
      slug: "encounter-tools",
    }).ok,
    true,
  );
  const invalid = validateTaxonomy({
    type: "tag",
    name: "Encounter Tools",
    slug: "Encounter Tools",
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.response.status, 400);
});

test("taxonomy errors identify duplicate slugs without leaking details", () => {
  assert.equal(
    taxonomyError(new Error("duplicate key violates unique constraint"), "updated"),
    "That taxonomy slug is already in use.",
  );
  assert.equal(
    taxonomyError(new Error("database unavailable"), "updated"),
    "The taxonomy entry could not be updated.",
  );
});

test("content wizard generates stable slugs and safe taxonomy defaults", () => {
  assert.equal(wizardSlug("  Savage Théâtre: Tools!  "), "savage-theatre-tools");
  const draft = createWizardDraftInput({
    title: "Savage Theatre",
    slug: "savage-theatre",
    resourceType: "module",
    defaultLocale: "en",
    facets: {
      authors: [{ id: "author-savage", name: "Savage Library", slug: "savage-library" }],
      categories: [{ id: "category-modules", name: "Foundry VTT Modules", slug: "foundry-modules" }],
      gameSystems: [{ id: "system-dnd5e", name: "D&D 5e", slug: "dnd5e" }],
      tags: [], foundryVersions: [], moduleVersions: [], classes: [],
    },
  });
  assert.equal(draft.categoryId, "category-modules");
  assert.equal(draft.authorId, "author-savage");
  assert.equal(draft.gameSystemId, "system-dnd5e");
  assert.equal(draft.isPublished, false);
});

test("content wizard publication checks enforce type-specific delivery", () => {
  const moduleValidation = validateResourceInput({
    ...validResource,
    defaultLocale: "en",
    accessMode: "public",
    patreonTierIds: [],
    translations: {
      en: { title: "Test Module", shortDescription: "A complete module description.", description: "Details", isPublished: false },
      es: { title: "", shortDescription: "", description: "", isPublished: false },
    },
    isPublished: false,
    useIconEverywhere: false,
  });
  assert.equal(moduleValidation.success, true);
  if (!moduleValidation.success) return;
  const blocked = wizardContentChecks(moduleValidation.data, {
    hasPrimaryFile: false,
    hasValidatedModuleRelease: false,
  });
  assert.ok(blocked.some((check) => check.level === "required" && /module ZIP/.test(check.message)));
  const ready = wizardContentChecks(moduleValidation.data, {
    hasPrimaryFile: false,
    hasValidatedModuleRelease: true,
  });
  assert.equal(ready.some((check) => check.level === "required"), false);
});

test("content wizard blocks incomplete required fields on their own step", () => {
  const resource: ResourceInput = {
    ...validResource,
    resourceType: "module",
    compatibilityStatus: "verified",
    pricing: "free",
    defaultLocale: "en" as const,
    accessMode: "public" as const,
    patreonTierIds: [],
    translations: {
      en: { title: "", shortDescription: "short", description: "", isPublished: false },
      es: { title: "", shortDescription: "", description: "", isPublished: false },
    },
    useIconEverywhere: false,
  };
  const capabilities = { hasPrimaryFile: false, hasValidatedModuleRelease: false };
  assert.deepEqual(wizardStepErrors(resource, 2, capabilities), {
    enTitle: "Enter a public title with at least two characters.",
    enShortDescription: "Enter a short description with at least 10 characters.",
  });
  assert.equal(
    wizardStepErrors(resource, 4, capabilities).release,
    "Upload a valid Foundry module ZIP before continuing.",
  );
});

test("content wizard enforces conditional class and Patreon requirements", () => {
  const resource: ResourceInput = {
    ...validResource,
    resourceType: "subclass" as const,
    compatibilityStatus: "verified",
    pricing: "premium",
    className: "",
    subclassName: "",
    defaultLocale: "en" as const,
    accessMode: "patreon" as const,
    patreonTierIds: [],
    translations: {
      en: { title: "Test", shortDescription: "A complete summary.", description: "", isPublished: false },
      es: { title: "", shortDescription: "", description: "", isPublished: false },
    },
    useIconEverywhere: false,
  };
  const capabilities = { hasPrimaryFile: false, hasValidatedModuleRelease: false };
  assert.deepEqual(wizardStepErrors(resource, 3, capabilities), {
    className: "Enter the parent class.",
    subclassName: "Enter the subclass name.",
  });
  assert.deepEqual(wizardStepErrors(resource, 5, capabilities), {
    patreonTierIds: "Choose at least one Patreon tier.",
  });
});
