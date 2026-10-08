import assert from "node:assert/strict";
import test from "node:test";
import { SEED_RESOURCES } from "../lib/data/seed-resources";
import { deriveCompatibilityStatus } from "../lib/domain/compatibility";
import {
  parsePublicCatalogFilters,
  publicCatalogParams,
  catalogFilterParams,
  filterCatalog,
  parseCatalogFilters,
} from "../lib/services/catalog";

test("public catalog accepts only type and system filters with search and sorting", () => {
  const input = {
    q: "craft",
    type: "module",
    system: "dnd5e",
    sort: "alphabetical",
    page: "2",
    pageSize: "1",
    tag: "crafting",
    author: "author",
    pricing: "premium",
    foundry: "13",
    version: "999",
    class: "fighter",
    compatibility: "unsupported",
    category: "pdfs",
  };
  const parsed = parsePublicCatalogFilters(input);
  assert.equal(parsed.tag, undefined);
  assert.equal(parsed.pricing, undefined);
  assert.equal(parsed.author, undefined);
  assert.equal(parsed.category, undefined);
  assert.deepEqual(publicCatalogParams(parsed), {
    q: "craft",
    type: "module",
    system: "dnd5e",
    sort: "alphabetical",
    page: "2",
    pageSize: "1",
  });
  assert.equal(
    parsePublicCatalogFilters(input, { category: "foundry-modules" }).category,
    "foundry-modules",
  );
  assert.equal(parseCatalogFilters(input).tag, "crafting");
});

test("homepage listing returns every match beyond the API page-size cap", () => {
  const resources = Array.from({ length: 65 }, (_, index) => ({
    ...SEED_RESOURCES[0],
    id: `resource-${index}`,
    slug: `resource-${index}`,
    title: `Resource ${String(index).padStart(2, "0")}`,
  }));
  const filters = parseCatalogFilters({
    page: "99",
    pageSize: "1",
    sort: "alphabetical",
  });
  const all = filterCatalog(resources, filters, { paginate: false });
  assert.equal(all.items.length, 65);
  assert.equal(new Set(all.items.map((resource) => resource.id)).size, 65);
  assert.equal(all.page, 1);
  assert.equal(all.pageCount, 1);
  assert.equal(all.items[0].title, "Resource 00");
  assert.equal(all.items[64].title, "Resource 64");
  assert.equal(
    filterCatalog(resources, { ...filters, page: 1 }).items.length,
    1,
  );
  const none = filterCatalog(
    resources,
    { ...filters, query: "no-matching-entry" },
    { paginate: false },
  );
  assert.equal(none.total, 0);
  assert.equal(none.pageCount, 1);
});

test("unpaginated catalog still composes filters and sorting", () => {
  const result = filterCatalog(
    SEED_RESOURCES,
    parseCatalogFilters({
      type: "module",
      system: "dnd5e",
      pricing: "free",
      sort: "most-downloaded",
    }),
    { paginate: false },
  );
  assert.equal(result.total, 2);
  assert.deepEqual(
    result.items.map((resource) => resource.slug),
    ["savage-craft", "savage-training"],
  );
});

test("homepage form state preserves normalized filters without pagination", () => {
  const params = catalogFilterParams(
    parseCatalogFilters({
      q: "  craft  ",
      type: "module",
      category: "foundry-modules",
      sort: "alphabetical",
      page: "99",
      pageSize: "1",
    }),
  );
  assert.deepEqual(params, {
    q: "craft",
    type: "module",
    category: "foundry-modules",
    sort: "alphabetical",
  });
  assert.equal("page" in params, false);
  assert.equal("pageSize" in params, false);
});

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
