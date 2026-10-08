import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../db";
import type { WriteDatabase } from "../../db/transaction";
import {
  resources,
  authors,
  categories,
  gameSystems,
  tags,
  resourceTags,
} from "../../db/schema";
import type { CatalogFilters, CatalogResult } from "../domain/resource";
import type { CatalogListingOptions } from "../services/catalog";
import { containsPattern } from "./query-utils";
import { publicCatalogSelection, mapSummary } from "./resource-mapping";

export async function listCatalogFromDatabase(
  filters: CatalogFilters,
  options: CatalogListingOptions = {},
  database?: Pick<WriteDatabase, "select">,
): Promise<CatalogResult> {
  const db = database ?? getDb();
  const conditions: SQL[] = [eq(resources.isPublished, true)];
  const query = filters.query?.trim();

  if (query) {
    const pattern = containsPattern(query);
    const taggedSearch = db
      .select({ id: resourceTags.resourceId })
      .from(resourceTags)
      .innerJoin(tags, eq(resourceTags.tagId, tags.id))
      .where(or(ilike(tags.name, pattern), ilike(tags.slug, pattern)));
    conditions.push(
      or(
        ilike(resources.title, pattern),
        ilike(resources.shortDescription, pattern),
        ilike(resources.description, pattern),
        ilike(authors.name, pattern),
        ilike(categories.name, pattern),
        ilike(gameSystems.name, pattern),
        inArray(resources.id, taggedSearch),
      )!,
    );
  }
  if (filters.resourceType) {
    conditions.push(eq(resources.resourceType, filters.resourceType));
  }
  if (filters.system) conditions.push(eq(gameSystems.slug, filters.system));
  if (filters.moduleVersion) {
    conditions.push(eq(resources.currentVersion, filters.moduleVersion));
  }
  if (filters.classOrSubclass) {
    const pattern = containsPattern(filters.classOrSubclass);
    conditions.push(
      or(
        ilike(resources.className, pattern),
        ilike(resources.subclassName, pattern),
      )!,
    );
  }
  if (filters.pricing) conditions.push(eq(resources.pricing, filters.pricing));
  if (filters.author) conditions.push(eq(authors.slug, filters.author));
  if (filters.category) conditions.push(eq(categories.slug, filters.category));
  if (filters.compatibility) {
    conditions.push(eq(resources.compatibilityStatus, filters.compatibility));
  }
  if (filters.foundryVersion) {
    const requestedVersion = Number.parseInt(filters.foundryVersion, 10);
    conditions.push(
      and(
        or(
          sql`${resources.foundryMinimum} IS NULL`,
          sql`CAST(substring(${resources.foundryMinimum} from '^([0-9]+)') AS INTEGER) <= ${requestedVersion}`,
        ),
        or(
          sql`${resources.foundryMaximum} IS NULL`,
          sql`CAST(substring(${resources.foundryMaximum} from '^([0-9]+)') AS INTEGER) >= ${requestedVersion}`,
        ),
      )!,
    );
  }
  if (filters.tag) {
    const taggedResources = db
      .select({ id: resourceTags.resourceId })
      .from(resourceTags)
      .innerJoin(tags, eq(resourceTags.tagId, tags.id))
      .where(eq(tags.slug, filters.tag));
    conditions.push(inArray(resources.id, taggedResources));
  }

  const where = and(...conditions);
  const orderBy = catalogOrder(filters.sort);
  const offset = (filters.page - 1) * filters.pageSize;
  const rowsQuery = db
    .select(publicCatalogSelection)
    .from(resources)
    .innerJoin(authors, eq(resources.authorId, authors.id))
    .innerJoin(categories, eq(resources.categoryId, categories.id))
    .innerJoin(gameSystems, eq(resources.gameSystemId, gameSystems.id))
    .where(where)
    .orderBy(orderBy, asc(resources.id))
    .$dynamic();
  const selectedRows =
    options.paginate === false
      ? rowsQuery
      : rowsQuery.limit(filters.pageSize).offset(offset);

  const [initialRows, totals] = await Promise.all([
    selectedRows,
    db
      .select({ value: count() })
      .from(resources)
      .innerJoin(authors, eq(resources.authorId, authors.id))
      .innerJoin(categories, eq(resources.categoryId, categories.id))
      .innerJoin(gameSystems, eq(resources.gameSystemId, gameSystems.id))
      .where(where),
  ]);

  let rows = initialRows;
  const total = totals[0]?.value ?? 0;
  const pageCount =
    options.paginate === false
      ? 1
      : Math.max(1, Math.ceil(total / filters.pageSize));
  const page =
    options.paginate === false ? 1 : Math.min(filters.page, pageCount);
  if (options.paginate !== false && page !== filters.page) {
    rows = await rowsQuery
      .limit(filters.pageSize)
      .offset((page - 1) * filters.pageSize);
  }
  const resourceIds = rows.map((row) => row.resource.id);
  const tagRows = resourceIds.length
    ? await db
        .select({ resourceId: resourceTags.resourceId, tag: tags })
        .from(resourceTags)
        .innerJoin(tags, eq(resourceTags.tagId, tags.id))
        .where(inArray(resourceTags.resourceId, resourceIds))
    : [];
  const tagsByResource = new Map<string, (typeof tags.$inferSelect)[]>();
  for (const row of tagRows) {
    const current = tagsByResource.get(row.resourceId) ?? [];
    current.push(row.tag);
    tagsByResource.set(row.resourceId, current);
  }

  return {
    items: rows.map((row) =>
      mapSummary(row, tagsByResource.get(row.resource.id) ?? []),
    ),
    total,
    page,
    pageSize:
      options.paginate === false ? Math.max(1, total) : filters.pageSize,
    pageCount,
  };
}

function catalogOrder(sort: CatalogFilters["sort"]) {
  switch (sort) {
    case "recently-updated":
      return desc(resources.updatedAt);
    case "alphabetical":
      return asc(resources.title);
    case "most-downloaded":
      return desc(resources.downloadCount);
    case "most-popular":
      return desc(resources.popularityScore);
    case "recently-added":
    default:
      return desc(resources.publishedAt);
  }
}
