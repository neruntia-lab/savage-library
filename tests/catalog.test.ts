import assert from "node:assert/strict";
import test from "node:test";
import { SEED_RESOURCES } from "../lib/data/seed-resources";
import { deriveCompatibilityStatus } from "../lib/domain/compatibility";
import { filterCatalog, parseCatalogFilters } from "../lib/services/catalog";

test("search covers titles, descriptions, authors, categories, tags, and systems", () => {
  for (const query of [
    "Savage Craft",
    "crafting loop",
    "José Felipe",
    "Foundry VTT Modules",
    "Automation",
    "D&D 5e",
  ]) {
    const result = filterCatalog(SEED_RESOURCES, {
      query,
      sort: "recently-added",
      page: 1,
      pageSize: 12,
    });
    assert.ok(result.items.some((item) => item.slug === "savage-craft"));
  }
});

test("catalog filters compose and pagination remains bounded", () => {
  const result = filterCatalog(SEED_RESOURCES, {
    resourceType: "module",
    system: "dnd5e",
    foundryVersion: "13",
    pricing: "free",
    compatibility: "verified",
    sort: "most-downloaded",
    page: 99,
    pageSize: 1,
  });

  assert.equal(result.total, 2);
  assert.equal(result.page, 2);
  assert.equal(result.pageCount, 2);
  assert.equal(result.items[0]?.slug, "savage-training");
});

test("query parser ignores invalid enums and clamps numeric inputs", () => {
  const parsed = parseCatalogFilters({
    type: "executable",
    pricing: "free",
    sort: "not-real",
    page: "-4",
    pageSize: "9000",
    q: "  tactical  ",
  });

  assert.equal(parsed.resourceType, undefined);
  assert.equal(parsed.pricing, "free");
  assert.equal(parsed.sort, "recently-added");
  assert.equal(parsed.page, 1);
  assert.equal(parsed.pageSize, 48);
  assert.equal(parsed.query, "tactical");
});

test("compatibility rules distinguish verified, outdated, and unsupported", () => {
  assert.equal(
    deriveCompatibilityStatus({ minimum: "11", verified: "13", maximum: "14" }),
    "verified",
  );
  assert.equal(
    deriveCompatibilityStatus({ minimum: "10", verified: "11", maximum: "12" }),
    "outdated",
  );
  assert.equal(
    deriveCompatibilityStatus({ minimum: "14", verified: "14", maximum: "15" }),
    "unsupported",
  );
});
