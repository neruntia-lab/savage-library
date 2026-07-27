import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../db";
import { ensureDatabaseSchema } from "../../db/bootstrap";
import {
  authors,
  categories,
  changelogEntries,
  dependencies,
  files,
  gameSystems,
  resourceTags,
  resources,
  resourceVersions,
  tags,
} from "../../db/schema";
import { SEED_FACETS, SEED_RESOURCES } from "../data/seed-resources";
import type {
  CatalogFacets,
  CatalogFilters,
  CatalogResult,
  ResourceDetails,
  ResourceSummary,
} from "../domain/resource";
import { filterCatalog } from "../services/catalog";
import type { ResourceInput } from "../validation/resource";

let seedPromise: Promise<void> | undefined;

export async function listCatalog(
  filters: CatalogFilters,
): Promise<CatalogResult> {
  try {
    await ensureSeedData();
    return await listCatalogFromDatabase(filters);
  } catch {
    return filterCatalog(SEED_RESOURCES, filters);
  }
}

export async function getFeaturedResources(
  limit = 3,
): Promise<ResourceSummary[]> {
  const result = await listCatalog({
    sort: "most-popular",
    page: 1,
    pageSize: Math.max(1, limit),
  });
  const featured = result.items.filter((item) => item.isFeatured);
  return (featured.length ? featured : result.items).slice(0, limit);
}

export async function getResourceBySlug(
  slug: string,
): Promise<ResourceDetails | null> {
  try {
    await ensureSeedData();
    const db = getDb();
    const rows = await db
      .select({
        resource: resources,
        author: authors,
        category: categories,
        system: gameSystems,
      })
      .from(resources)
      .innerJoin(authors, eq(resources.authorId, authors.id))
      .innerJoin(categories, eq(resources.categoryId, categories.id))
      .innerJoin(gameSystems, eq(resources.gameSystemId, gameSystems.id))
      .where(and(eq(resources.slug, slug), eq(resources.isPublished, true)))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const [tagRows, fileRows, dependencyRows, changelogRows] =
      await Promise.all([
        db
          .select({ tag: tags })
          .from(resourceTags)
          .innerJoin(tags, eq(resourceTags.tagId, tags.id))
          .where(eq(resourceTags.resourceId, row.resource.id)),
        db
          .select({ file: files })
          .from(files)
          .innerJoin(
            resourceVersions,
            eq(files.resourceVersionId, resourceVersions.id),
          )
          .where(
            and(
              eq(resourceVersions.resourceId, row.resource.id),
              eq(resourceVersions.isCurrent, true),
              inArray(files.kind, ["pdf", "module"]),
            ),
          ),
        db
          .select()
          .from(dependencies)
          .where(eq(dependencies.resourceId, row.resource.id)),
        db
          .select({
            entry: changelogEntries,
            version: resourceVersions.version,
          })
          .from(changelogEntries)
          .innerJoin(
            resourceVersions,
            eq(changelogEntries.resourceVersionId, resourceVersions.id),
          )
          .where(eq(resourceVersions.resourceId, row.resource.id))
          .orderBy(desc(changelogEntries.publishedAt)),
      ]);

    const related = await listCatalogFromDatabase({
      category: row.category.slug,
      sort: "most-popular",
      page: 1,
      pageSize: 4,
    });

    return {
      ...mapSummary(row, tagRows.map((entry) => entry.tag)),
      description: row.resource.description,
      compatibilityNotes: row.resource.compatibilityNotes,
      coverUrl: storageImageUrl(row.resource.coverKey),
      installationInstructions: row.resource.installationInstructions,
      licenseName: row.resource.licenseName,
      licenseUrl: row.resource.licenseUrl,
      manifestUrl: row.resource.manifestUrl,
      projectUrl: row.resource.projectUrl,
      files: fileRows.map(({ file }) => ({
        id: file.id,
        kind: file.kind as ResourceDetails["files"][number]["kind"],
        name: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        isRestricted: file.isRestricted,
      })),
      dependencies: dependencyRows.map((dependency) => ({
        id: dependency.id,
        name: dependency.name,
        versionRange: dependency.versionRange,
        url: dependency.url,
        isRequired: dependency.isRequired,
      })),
      changelog: changelogRows.map(({ entry, version }) => ({
        id: entry.id,
        version,
        summary: entry.summary,
        details: entry.details,
        publishedAt: entry.publishedAt,
      })),
      relatedResources: related.items
        .filter((item) => item.id !== row.resource.id)
        .slice(0, 3),
    };
  } catch {
    return SEED_RESOURCES.find((resource) => resource.slug === slug) ?? null;
  }
}

export async function getCatalogFacets(): Promise<CatalogFacets> {
  try {
    await ensureSeedData();
    const db = getDb();
    const [
      authorRows,
      categoryRows,
      systemRows,
      tagRows,
      versionRows,
      classRows,
    ] = await Promise.all([
      db.select().from(authors).orderBy(asc(authors.name)),
      db.select().from(categories).orderBy(asc(categories.name)),
      db.select().from(gameSystems).orderBy(asc(gameSystems.name)),
      db.select().from(tags).orderBy(asc(tags.name)),
      db
        .select({ version: resources.currentVersion })
        .from(resources)
        .groupBy(resources.currentVersion),
      db
        .select({ className: resources.className })
        .from(resources)
        .where(like(resources.className, "%"))
        .groupBy(resources.className),
    ]);

    return {
      authors: authorRows.map(({ id, name, slug }) => ({ id, name, slug })),
      categories: categoryRows.map(({ id, name, slug }) => ({
        id,
        name,
        slug,
      })),
      gameSystems: systemRows.map(({ id, name, slug }) => ({
        id,
        name,
        slug,
      })),
      tags: tagRows.map(({ id, name, slug }) => ({ id, name, slug })),
      foundryVersions: ["11", "12", "13", "14"],
      moduleVersions: versionRows.map(({ version }) => version).sort(),
      classes: classRows
        .map(({ className }) => className)
        .filter((value): value is string => Boolean(value))
        .sort(),
    };
  } catch {
    return SEED_FACETS;
  }
}

export async function listAdminResources(): Promise<
  Array<{
    id: string;
    slug: string;
    title: string;
    resourceType: string;
    currentVersion: string;
    isPublished: boolean;
    isFeatured: boolean;
    downloadCount: number;
    updatedAt: string;
    resourceVersionId: string;
  }>
> {
  try {
    await ensureSeedData();
    return await getDb()
      .select({
        id: resources.id,
        slug: resources.slug,
        title: resources.title,
        resourceType: resources.resourceType,
        currentVersion: resources.currentVersion,
        isPublished: resources.isPublished,
        isFeatured: resources.isFeatured,
        downloadCount: resources.downloadCount,
        updatedAt: resources.updatedAt,
        resourceVersionId: resourceVersions.id,
      })
      .from(resources)
      .innerJoin(
        resourceVersions,
        and(
          eq(resourceVersions.resourceId, resources.id),
          eq(resourceVersions.isCurrent, true),
        ),
      )
      .orderBy(desc(resources.updatedAt));
  } catch {
    return SEED_RESOURCES.map((resource) => ({
      id: resource.id,
      slug: resource.slug,
      title: resource.title,
      resourceType: resource.resourceType,
      currentVersion: resource.currentVersion,
      isPublished: true,
      isFeatured: resource.isFeatured,
      downloadCount: resource.downloadCount,
      updatedAt: resource.updatedAt,
      resourceVersionId: `version-${resource.id}-${resource.currentVersion}`,
    }));
  }
}

export async function getAdminResource(
  id: string,
): Promise<(ResourceInput & { id: string }) | null> {
  await ensureSeedData();
  const db = getDb();
  const rows = await db
    .select()
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1);
  const resource = rows[0];
  if (!resource) return null;

  const [tagRows, dependencyRows] = await Promise.all([
    db
      .select({ tagId: resourceTags.tagId })
      .from(resourceTags)
      .where(eq(resourceTags.resourceId, id)),
    db
      .select()
      .from(dependencies)
      .where(eq(dependencies.resourceId, id)),
  ]);

  return {
    id: resource.id,
    title: resource.title,
    slug: resource.slug,
    shortDescription: resource.shortDescription,
    description: resource.description,
    resourceType: resource.resourceType as ResourceInput["resourceType"],
    categoryId: resource.categoryId,
    authorId: resource.authorId,
    gameSystemId: resource.gameSystemId,
    className: resource.className ?? undefined,
    subclassName: resource.subclassName ?? undefined,
    currentVersion: resource.currentVersion,
    foundryMinimum: resource.foundryMinimum ?? undefined,
    foundryVerified: resource.foundryVerified ?? undefined,
    foundryMaximum: resource.foundryMaximum ?? undefined,
    compatibilityStatus:
      resource.compatibilityStatus as ResourceInput["compatibilityStatus"],
    compatibilityNotes: resource.compatibilityNotes ?? undefined,
    pricing: resource.pricing as ResourceInput["pricing"],
    priceLabel: resource.priceLabel ?? undefined,
    manifestUrl: resource.manifestUrl ?? undefined,
    projectUrl: resource.projectUrl ?? undefined,
    licenseName: resource.licenseName ?? undefined,
    installationInstructions: resource.installationInstructions ?? undefined,
    tagIds: tagRows.map(({ tagId }) => tagId),
    dependencies: dependencyRows.map((dependency) => ({
      name: dependency.name,
      versionRange: dependency.versionRange ?? undefined,
      url: dependency.url ?? undefined,
      isRequired: dependency.isRequired,
    })),
    isFeatured: resource.isFeatured,
    isPublished: resource.isPublished,
  };
}

export async function createResource(input: ResourceInput): Promise<string> {
  await ensureSeedData();
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(resources).values({
    id,
    slug: input.slug,
    title: input.title,
    shortDescription: input.shortDescription,
    description: input.description,
    resourceType: input.resourceType,
    categoryId: input.categoryId,
    authorId: input.authorId,
    gameSystemId: input.gameSystemId,
    className: input.className,
    subclassName: input.subclassName,
    currentVersion: input.currentVersion,
    foundryMinimum: input.foundryMinimum,
    foundryVerified: input.foundryVerified,
    foundryMaximum: input.foundryMaximum,
    compatibilityStatus: input.compatibilityStatus,
    compatibilityNotes: input.compatibilityNotes,
    pricing: input.pricing,
    priceLabel: input.priceLabel,
    manifestUrl: input.manifestUrl,
    projectUrl: input.projectUrl,
    licenseName: input.licenseName,
    installationInstructions: input.installationInstructions,
    isFeatured: input.isFeatured,
    isPublished: input.isPublished,
    publishedAt: input.isPublished ? now : null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(resourceVersions).values({
    id: crypto.randomUUID(),
    resourceId: id,
    version: input.currentVersion,
    foundryMinimum: input.foundryMinimum,
    foundryVerified: input.foundryVerified,
    foundryMaximum: input.foundryMaximum,
    isCurrent: true,
    releasedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await replaceResourceRelations(db, id, input, now, input.currentVersion);
  return id;
}

export async function updateResource(
  id: string,
  input: ResourceInput,
): Promise<boolean> {
  await ensureSeedData();
  const db = getDb();
  const existing = await db
    .select({ currentVersion: resources.currentVersion })
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1);
  const result = await db
    .update(resources)
    .set({
      slug: input.slug,
      title: input.title,
      shortDescription: input.shortDescription,
      description: input.description,
      resourceType: input.resourceType,
      categoryId: input.categoryId,
      authorId: input.authorId,
      gameSystemId: input.gameSystemId,
      className: input.className,
      subclassName: input.subclassName,
      currentVersion: input.currentVersion,
      foundryMinimum: input.foundryMinimum,
      foundryVerified: input.foundryVerified,
      foundryMaximum: input.foundryMaximum,
      compatibilityStatus: input.compatibilityStatus,
      compatibilityNotes: input.compatibilityNotes,
      pricing: input.pricing,
      priceLabel: input.priceLabel,
      manifestUrl: input.manifestUrl,
      projectUrl: input.projectUrl,
      licenseName: input.licenseName,
      installationInstructions: input.installationInstructions,
      isFeatured: input.isFeatured,
      isPublished: input.isPublished,
      publishedAt: input.isPublished ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(resources.id, id));

  const now = new Date().toISOString();
  if (existing[0]?.currentVersion !== input.currentVersion) {
    await db
      .update(resourceVersions)
      .set({ isCurrent: false, updatedAt: now })
      .where(eq(resourceVersions.resourceId, id));
    await db
      .insert(resourceVersions)
      .values({
        id: crypto.randomUUID(),
        resourceId: id,
        version: input.currentVersion,
        foundryMinimum: input.foundryMinimum,
        foundryVerified: input.foundryVerified,
        foundryMaximum: input.foundryMaximum,
        isCurrent: true,
        releasedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  } else {
    await db
      .update(resourceVersions)
      .set({
        foundryMinimum: input.foundryMinimum,
        foundryVerified: input.foundryVerified,
        foundryMaximum: input.foundryMaximum,
        updatedAt: now,
      })
      .where(
        and(
          eq(resourceVersions.resourceId, id),
          eq(resourceVersions.isCurrent, true),
        ),
      );
  }
  await replaceResourceRelations(db, id, input, now, input.currentVersion);
  return Boolean(result.meta.changes);
}

export async function setResourcePublication(
  id: string,
  isPublished: boolean,
): Promise<boolean> {
  const result = await getDb()
    .update(resources)
    .set({
      isPublished,
      publishedAt: isPublished ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(resources.id, id));
  return Boolean(result.meta.changes);
}

export async function deleteResource(id: string): Promise<boolean> {
  const result = await getDb()
    .delete(resources)
    .where(eq(resources.id, id));
  return Boolean(result.meta.changes);
}

export async function getResourceStorageKeys(id: string): Promise<string[]> {
  await ensureDatabaseSchema();
  const rows = await getDb()
    .select({ storageKey: files.storageKey })
    .from(files)
    .innerJoin(
      resourceVersions,
      eq(files.resourceVersionId, resourceVersions.id),
    )
    .where(eq(resourceVersions.resourceId, id));
  return Array.from(new Set(rows.map(({ storageKey }) => storageKey)));
}

async function listCatalogFromDatabase(
  filters: CatalogFilters,
): Promise<CatalogResult> {
  const db = getDb();
  const conditions: SQL[] = [eq(resources.isPublished, true)];
  const query = filters.query?.trim();

  if (query) {
    const pattern = `%${query.slice(0, 120)}%`;
    const taggedSearch = db
      .select({ id: resourceTags.resourceId })
      .from(resourceTags)
      .innerJoin(tags, eq(resourceTags.tagId, tags.id))
      .where(or(like(tags.name, pattern), like(tags.slug, pattern)));
    conditions.push(
      or(
        like(resources.title, pattern),
        like(resources.shortDescription, pattern),
        like(resources.description, pattern),
        like(authors.name, pattern),
        like(categories.name, pattern),
        like(gameSystems.name, pattern),
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
    const pattern = `%${filters.classOrSubclass}%`;
    conditions.push(
      or(
        like(resources.className, pattern),
        like(resources.subclassName, pattern),
      )!,
    );
  }
  if (filters.pricing) conditions.push(eq(resources.pricing, filters.pricing));
  if (filters.author) conditions.push(eq(authors.slug, filters.author));
  if (filters.category) conditions.push(eq(categories.slug, filters.category));
  if (filters.compatibility) {
    conditions.push(
      eq(resources.compatibilityStatus, filters.compatibility),
    );
  }
  if (filters.foundryVersion) {
    const requestedVersion = Number.parseInt(filters.foundryVersion, 10);
    conditions.push(
      and(
        or(
          sql`${resources.foundryMinimum} IS NULL`,
          sql`CAST(${resources.foundryMinimum} AS INTEGER) <= ${requestedVersion}`,
        ),
        or(
          sql`${resources.foundryMaximum} IS NULL`,
          sql`CAST(${resources.foundryMaximum} AS INTEGER) >= ${requestedVersion}`,
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

  const [rows, totals] = await Promise.all([
    db
      .select({
        resource: resources,
        author: authors,
        category: categories,
        system: gameSystems,
      })
      .from(resources)
      .innerJoin(authors, eq(resources.authorId, authors.id))
      .innerJoin(categories, eq(resources.categoryId, categories.id))
      .innerJoin(gameSystems, eq(resources.gameSystemId, gameSystems.id))
      .where(where)
      .orderBy(orderBy)
      .limit(filters.pageSize)
      .offset(offset),
    db
      .select({ value: count() })
      .from(resources)
      .innerJoin(authors, eq(resources.authorId, authors.id))
      .innerJoin(categories, eq(resources.categoryId, categories.id))
      .innerJoin(gameSystems, eq(resources.gameSystemId, gameSystems.id))
      .where(where),
  ]);

  const resourceIds = rows.map((row) => row.resource.id);
  const tagRows = resourceIds.length
    ? await db
        .select({ resourceId: resourceTags.resourceId, tag: tags })
        .from(resourceTags)
        .innerJoin(tags, eq(resourceTags.tagId, tags.id))
        .where(inArray(resourceTags.resourceId, resourceIds))
    : [];
  const tagsByResource = new Map<string, typeof tags.$inferSelect[]>();
  for (const row of tagRows) {
    const current = tagsByResource.get(row.resourceId) ?? [];
    current.push(row.tag);
    tagsByResource.set(row.resourceId, current);
  }

  const total = totals[0]?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  return {
    items: rows.map((row) =>
      mapSummary(row, tagsByResource.get(row.resource.id) ?? []),
    ),
    total,
    page: Math.min(filters.page, pageCount),
    pageSize: filters.pageSize,
    pageCount,
  };
}

function mapSummary(
  row: {
    resource: typeof resources.$inferSelect;
    author: typeof authors.$inferSelect;
    category: typeof categories.$inferSelect;
    system: typeof gameSystems.$inferSelect;
  },
  tagRows: Array<typeof tags.$inferSelect>,
): ResourceSummary {
  return {
    id: row.resource.id,
    slug: row.resource.slug,
    title: row.resource.title,
    shortDescription: row.resource.shortDescription,
    resourceType: row.resource.resourceType as ResourceSummary["resourceType"],
    category: {
      id: row.category.id,
      name: row.category.name,
      slug: row.category.slug,
    },
    author: {
      id: row.author.id,
      name: row.author.name,
      slug: row.author.slug,
      websiteUrl: row.author.websiteUrl,
    },
    gameSystem: {
      id: row.system.id,
      name: row.system.name,
      slug: row.system.slug,
    },
    className: row.resource.className,
    subclassName: row.resource.subclassName,
    currentVersion: row.resource.currentVersion,
    foundryMinimum: row.resource.foundryMinimum,
    foundryVerified: row.resource.foundryVerified,
    foundryMaximum: row.resource.foundryMaximum,
    compatibilityStatus:
      row.resource.compatibilityStatus as ResourceSummary["compatibilityStatus"],
    pricing: row.resource.pricing as ResourceSummary["pricing"],
    priceLabel: row.resource.priceLabel,
    tags: tagRows.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
    })),
    thumbnailUrl: storageImageUrl(row.resource.thumbnailKey),
    isFeatured: row.resource.isFeatured,
    downloadCount: row.resource.downloadCount,
    popularityScore: row.resource.popularityScore,
    publishedAt: row.resource.publishedAt ?? row.resource.createdAt,
    updatedAt: row.resource.updatedAt,
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

function storageImageUrl(key?: string | null): string | null {
  return key
    ? `/api/assets/${key
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`
    : "/logo.png";
}

async function replaceResourceRelations(
  db: ReturnType<typeof getDb>,
  resourceId: string,
  input: ResourceInput,
  now: string,
  version: string,
): Promise<void> {
  await db.delete(resourceTags).where(eq(resourceTags.resourceId, resourceId));
  if (input.tagIds.length) {
    await db
      .insert(resourceTags)
      .values(input.tagIds.map((tagId) => ({ resourceId, tagId })))
      .onConflictDoNothing();
  }

  await db.delete(dependencies).where(eq(dependencies.resourceId, resourceId));
  if (input.dependencies.length) {
    await db.insert(dependencies).values(
      input.dependencies.map((dependency) => ({
        id: crypto.randomUUID(),
        resourceId,
        name: dependency.name,
        versionRange: dependency.versionRange,
        url: dependency.url,
        isRequired: dependency.isRequired,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  if (input.changelogSummary) {
    const versionRows = await db
      .select({ id: resourceVersions.id })
      .from(resourceVersions)
      .where(
        and(
          eq(resourceVersions.resourceId, resourceId),
          eq(resourceVersions.version, version),
        ),
      )
      .limit(1);
    if (versionRows[0]) {
      await db.insert(changelogEntries).values({
        id: crypto.randomUUID(),
        resourceVersionId: versionRows[0].id,
        summary: input.changelogSummary,
        details: input.changelogDetails ?? "",
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

async function ensureSeedData(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = seedDatabase().catch((error) => {
    seedPromise = undefined;
    throw error;
  });
  return seedPromise;
}

async function seedDatabase(): Promise<void> {
  await ensureDatabaseSchema();
  const db = getDb();
  const categoryRows = Array.from(
    new Map(
      SEED_RESOURCES.map((resource) => [
        resource.category.id,
        resource.category,
      ]),
    ).values(),
  );
  const authorRows = Array.from(
    new Map(
      SEED_RESOURCES.map((resource) => [resource.author.id, resource.author]),
    ).values(),
  );
  const systemRows = Array.from(
    new Map(
      SEED_RESOURCES.map((resource) => [
        resource.gameSystem.id,
        resource.gameSystem,
      ]),
    ).values(),
  );
  const tagRows = Array.from(
    new Map(
      SEED_RESOURCES.flatMap((resource) =>
        resource.tags.map((tag) => [tag.id, tag]),
      ),
    ).values(),
  );

  await db
    .insert(categories)
    .values(
      categoryRows.map((category) => ({
        ...category,
        description: "",
      })),
    )
    .onConflictDoNothing();
  await db.insert(authors).values(authorRows).onConflictDoNothing();
  await db.insert(gameSystems).values(systemRows).onConflictDoNothing();
  await db.insert(tags).values(tagRows).onConflictDoNothing();

  for (const resource of SEED_RESOURCES) {
    await db
      .insert(resources)
      .values({
        id: resource.id,
        slug: resource.slug,
        title: resource.title,
        shortDescription: resource.shortDescription,
        description: resource.description,
        resourceType: resource.resourceType,
        categoryId: resource.category.id,
        authorId: resource.author.id,
        gameSystemId: resource.gameSystem.id,
        className: resource.className,
        subclassName: resource.subclassName,
        currentVersion: resource.currentVersion,
        foundryMinimum: resource.foundryMinimum,
        foundryVerified: resource.foundryVerified,
        foundryMaximum: resource.foundryMaximum,
        compatibilityStatus: resource.compatibilityStatus,
        compatibilityNotes: resource.compatibilityNotes,
        pricing: resource.pricing,
        priceLabel: resource.priceLabel,
        installationInstructions: resource.installationInstructions,
        licenseName: resource.licenseName,
        licenseUrl: resource.licenseUrl,
        manifestUrl: resource.manifestUrl,
        projectUrl: resource.projectUrl,
        isFeatured: resource.isFeatured,
        isPublished: true,
        downloadCount: resource.downloadCount,
        popularityScore: resource.popularityScore,
        publishedAt: resource.publishedAt,
        createdAt: resource.publishedAt,
        updatedAt: resource.updatedAt,
      })
      .onConflictDoNothing();

    const versionId = `version-${resource.id}-${resource.currentVersion}`;
    await db
      .insert(resourceVersions)
      .values({
        id: versionId,
        resourceId: resource.id,
        version: resource.currentVersion,
        foundryMinimum: resource.foundryMinimum,
        foundryVerified: resource.foundryVerified,
        foundryMaximum: resource.foundryMaximum,
        isCurrent: true,
        releasedAt: resource.updatedAt,
        createdAt: resource.publishedAt,
        updatedAt: resource.updatedAt,
      })
      .onConflictDoNothing();

    if (resource.tags.length) {
      await db
        .insert(resourceTags)
        .values(
          resource.tags.map((tag) => ({
            resourceId: resource.id,
            tagId: tag.id,
          })),
        )
        .onConflictDoNothing();
    }

    for (const entry of resource.changelog) {
      await db
        .insert(changelogEntries)
        .values({
          id: entry.id,
          resourceVersionId: versionId,
          summary: entry.summary,
          details: entry.details,
          publishedAt: entry.publishedAt,
          createdAt: entry.publishedAt,
          updatedAt: entry.publishedAt,
        })
        .onConflictDoNothing();
    }

    for (const dependency of resource.dependencies) {
      await db
        .insert(dependencies)
        .values({
          id: dependency.id,
          resourceId: resource.id,
          name: dependency.name,
          versionRange: dependency.versionRange,
          url: dependency.url,
          isRequired: dependency.isRequired,
        })
        .onConflictDoNothing();
    }
  }
}
