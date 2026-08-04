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
  patreonTiers,
  patreonPosts,
  protectedPostLinks,
  resourcePatreonTiers,
  resourceTags,
  resourceTranslations,
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
  requestedLocale?: "en" | "es",
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

    const translationRows = await db
      .select()
      .from(resourceTranslations)
      .where(
        and(
          eq(resourceTranslations.resourceId, row.resource.id),
          eq(resourceTranslations.isPublished, true),
        ),
      );
    const defaultLocale =
      row.resource.defaultLocale === "es" ? ("es" as const) : ("en" as const);
    const activeTranslation =
      translationRows.find(
        (translation) => translation.locale === requestedLocale,
      ) ??
      translationRows.find(
        (translation) => translation.locale === defaultLocale,
      );
    const activeLocale =
      activeTranslation?.locale === "es"
        ? ("es" as const)
        : activeTranslation?.locale === "en"
          ? ("en" as const)
          : defaultLocale;

    const [tagRows, fileRows, dependencyRows, changelogRows, tierRows, protectedRows] =
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
              inArray(files.kind, ["pdf", "module", "macro"]),
              eq(files.locale, activeLocale),
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
        db
          .select({
            id: patreonTiers.id,
            title: patreonTiers.title,
            amountCents: patreonTiers.amountCents,
            url: patreonTiers.url,
          })
          .from(resourcePatreonTiers)
          .innerJoin(
            patreonTiers,
            eq(resourcePatreonTiers.tierId, patreonTiers.id),
          )
          .where(eq(resourcePatreonTiers.resourceId, row.resource.id))
          .orderBy(asc(patreonTiers.amountCents)),
        db
          .select({
            id: protectedPostLinks.id,
            label: protectedPostLinks.label,
            role: protectedPostLinks.role,
          })
          .from(protectedPostLinks)
          .innerJoin(
            patreonPosts,
            eq(protectedPostLinks.postId, patreonPosts.id),
          )
          .where(
            and(
              eq(patreonPosts.resourceId, row.resource.id),
              eq(patreonPosts.reviewStatus, "approved"),
            ),
          ),
      ]);

    const related = await listCatalogFromDatabase({
      category: row.category.slug,
      sort: "most-popular",
      page: 1,
      pageSize: 4,
    });

    return {
      ...mapSummary(row, tagRows.map((entry) => entry.tag)),
      title: activeTranslation?.title || row.resource.title,
      shortDescription:
        activeTranslation?.shortDescription || row.resource.shortDescription,
      description: activeTranslation?.description || row.resource.description,
      compatibilityNotes:
        activeTranslation?.compatibilityNotes ??
        row.resource.compatibilityNotes,
      coverUrl: storageImageUrl(row.resource.coverKey),
      installationInstructions:
        activeTranslation?.installationInstructions ??
        row.resource.installationInstructions,
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
      accessMode:
        row.resource.accessMode === "patreon" ? "patreon" : "public",
      defaultLocale,
      activeLocale,
      availableLocales: translationRows
        .map((translation) => translation.locale)
        .filter(
          (locale): locale is "en" | "es" =>
            locale === "en" || locale === "es",
        ),
      allowedPatreonTiers: tierRows,
      protectedDownloads: protectedRows,
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
    accessMode: "public" | "patreon";
    defaultLocale: "en" | "es";
    thumbnailUrl: string | null;
    revision: number;
    pendingReleaseCount: number;
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
        accessMode: resources.accessMode,
        defaultLocale: resources.defaultLocale,
        thumbnailKey: resources.thumbnailKey,
        revision: resources.revision,
        pendingReleaseCount: sql<number>`(
          select count(*)::int
          from resource_versions as pending_release
          where pending_release.resource_id = ${resources.id}
            and pending_release.release_status in ('draft', 'failed')
        )`,
      })
      .from(resources)
      .innerJoin(
        resourceVersions,
        and(
          eq(resourceVersions.resourceId, resources.id),
          eq(resourceVersions.isCurrent, true),
        ),
      )
      .orderBy(desc(resources.updatedAt))
      .then((rows) =>
        rows.map(({ thumbnailKey, ...row }) => ({
          ...row,
          accessMode: row.accessMode as "public" | "patreon",
          defaultLocale: row.defaultLocale as "en" | "es",
          thumbnailUrl: storageImageUrl(thumbnailKey),
        })),
      );
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
      accessMode: "public" as const,
      defaultLocale: "en" as const,
      thumbnailUrl: resource.thumbnailUrl ?? null,
      revision: 1,
      pendingReleaseCount: 0,
    }));
  }
}

export async function getAdminResource(
  id: string,
): Promise<
  | (ResourceInput & {
      id: string;
      resourceVersionId: string;
      coverUrl: string | null;
      thumbnailUrl: string | null;
      files: Array<{
        id: string;
        kind: string;
        locale: "en" | "es";
        originalName: string;
        sizeBytes: number;
      }>;
      releases: Array<{
        id: string;
        version: string;
        isCurrent: boolean;
        releasedAt: string;
      }>;
    })
  | null
> {
  await ensureSeedData();
  const db = getDb();
  const rows = await db
    .select()
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1);
  const resource = rows[0];
  if (!resource) return null;

  const [tagRows, dependencyRows, translationRows, tierRows, versionRows, fileRows] = await Promise.all([
    db
      .select({ tagId: resourceTags.tagId })
      .from(resourceTags)
      .where(eq(resourceTags.resourceId, id)),
    db
      .select()
      .from(dependencies)
      .where(eq(dependencies.resourceId, id)),
    db
      .select()
      .from(resourceTranslations)
      .where(eq(resourceTranslations.resourceId, id)),
    db
      .select({ tierId: resourcePatreonTiers.tierId })
      .from(resourcePatreonTiers)
      .where(eq(resourcePatreonTiers.resourceId, id)),
    db
      .select({
        id: resourceVersions.id,
        version: resourceVersions.version,
        isCurrent: resourceVersions.isCurrent,
        releasedAt: resourceVersions.releasedAt,
      })
      .from(resourceVersions)
      .where(eq(resourceVersions.resourceId, id))
      .orderBy(desc(resourceVersions.releasedAt)),
    db
      .select({
        id: files.id,
        kind: files.kind,
        locale: files.locale,
        originalName: files.originalName,
        sizeBytes: files.sizeBytes,
      })
      .from(files)
      .innerJoin(
        resourceVersions,
        eq(files.resourceVersionId, resourceVersions.id),
      )
      .where(
        and(
          eq(resourceVersions.resourceId, id),
          eq(resourceVersions.isCurrent, true),
        ),
      ),
  ]);
  const translation = (locale: "en" | "es") => {
    const row = translationRows.find((entry) => entry.locale === locale);
    return {
      title: row?.title ?? (locale === "en" ? resource.title : ""),
      shortDescription:
        row?.shortDescription ??
        (locale === "en" ? resource.shortDescription : ""),
      description:
        row?.description ?? (locale === "en" ? resource.description : ""),
      compatibilityNotes:
        row?.compatibilityNotes ??
        (locale === "en" ? resource.compatibilityNotes ?? undefined : undefined),
      installationInstructions:
        row?.installationInstructions ??
        (locale === "en"
          ? resource.installationInstructions ?? undefined
          : undefined),
      priceLabel:
        row?.priceLabel ??
        (locale === "en" ? resource.priceLabel ?? undefined : undefined),
      isPublished: row?.isPublished ?? (locale === "en" && resource.isPublished),
    };
  };

  return {
    id: resource.id,
    coverUrl: storageImageUrl(resource.coverKey),
    thumbnailUrl: storageImageUrl(resource.thumbnailKey),
    resourceVersionId:
      versionRows.find((version) => version.isCurrent)?.id ?? "",
    files: fileRows.map((file) => ({
      ...file,
      locale: file.locale === "es" ? ("es" as const) : ("en" as const),
    })),
    releases: versionRows,
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
    defaultLocale: resource.defaultLocale as "en" | "es",
    accessMode: resource.accessMode as "public" | "patreon",
    patreonTierIds: tierRows.map(({ tierId }) => tierId),
    translations: {
      en: translation("en"),
      es: translation("es"),
    },
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
    defaultLocale: input.defaultLocale,
    accessMode: input.accessMode,
    licenseName: input.licenseName,
    installationInstructions: input.installationInstructions,
    isFeatured: input.isFeatured,
    isPublished: input.isPublished,
    publishedAt: input.isPublished ? now : null,
    createdAt: now,
    updatedAt: now,
  });

  const versionId = crypto.randomUUID();
  await db.insert(resourceVersions).values({
    id: versionId,
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
  await replaceResourceTranslations(db, id, input, now);
  await replacePatreonTiers(db, id, input.patreonTierIds);
  return id;
}

export async function updateResource(
  id: string,
  input: ResourceInput,
): Promise<boolean> {
  await ensureSeedData();
  const db = getDb();
  const now = new Date().toISOString();
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
      defaultLocale: input.defaultLocale,
      accessMode: input.accessMode,
      licenseName: input.licenseName,
      installationInstructions: input.installationInstructions,
      isFeatured: input.isFeatured,
      isPublished: input.isPublished,
      publishedAt: input.isPublished
        ? sql`COALESCE(${resources.publishedAt}, ${now})`
        : resources.publishedAt,
      revision: sql`${resources.revision} + 1`,
      updatedAt: now,
    })
    .where(eq(resources.id, id))
    .returning({ id: resources.id });
  if (!result[0]) return false;

  if (existing[0]?.currentVersion !== input.currentVersion) {
    const targetVersion = await db
      .select({ id: resourceVersions.id })
      .from(resourceVersions)
      .where(
        and(
          eq(resourceVersions.resourceId, id),
          eq(resourceVersions.version, input.currentVersion),
        ),
      )
      .limit(1);
    await db
      .update(resourceVersions)
      .set({ isCurrent: false, updatedAt: now })
      .where(eq(resourceVersions.resourceId, id));
    if (targetVersion[0]) {
      await db
        .update(resourceVersions)
        .set({
          foundryMinimum: input.foundryMinimum,
          foundryVerified: input.foundryVerified,
          foundryMaximum: input.foundryMaximum,
          isCurrent: true,
          updatedAt: now,
        })
        .where(eq(resourceVersions.id, targetVersion[0].id));
    } else {
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
    }
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
  await replaceResourceTranslations(db, id, input, now);
  await replacePatreonTiers(db, id, input.patreonTierIds);
  return true;
}

export async function setResourcePublication(
  id: string,
  isPublished: boolean,
): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await getDb()
    .update(resources)
    .set({
      isPublished,
      publishedAt: isPublished
        ? sql`COALESCE(${resources.publishedAt}, ${now})`
        : resources.publishedAt,
      updatedAt: now,
    })
    .where(eq(resources.id, id))
    .returning({ id: resources.id });
  return Boolean(result[0]);
}

export async function deleteResource(id: string): Promise<boolean> {
  const result = await getDb()
    .delete(resources)
    .where(eq(resources.id, id))
    .returning({ id: resources.id });
  return Boolean(result[0]);
}

export async function getResourceStorageKeys(id: string): Promise<string[]> {
  await ensureDatabaseSchema();
  const rows = await getDb()
    .select({ storageKey: files.storageKey, storageUrl: files.storageUrl })
    .from(files)
    .innerJoin(
      resourceVersions,
      eq(files.resourceVersionId, resourceVersions.id),
    )
    .where(eq(resourceVersions.resourceId, id));
  return Array.from(
    new Set(rows.map(({ storageKey, storageUrl }) => storageUrl ?? storageKey)),
  );
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
    accessMode:
      row.resource.accessMode === "patreon" ? "patreon" : "public",
    defaultLocale:
      row.resource.defaultLocale === "es" ? "es" : "en",
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
  if (key?.startsWith("http://") || key?.startsWith("https://")) return key;
  return key
    ? `/api/assets/${key
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`
    : null;
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
      const existingRows = await db
        .select({ id: changelogEntries.id })
        .from(changelogEntries)
        .where(
          and(
            eq(changelogEntries.resourceVersionId, versionRows[0].id),
            eq(changelogEntries.summary, input.changelogSummary),
          ),
        )
        .limit(1);

      if (existingRows[0]) {
        await db
          .update(changelogEntries)
          .set({
            details: input.changelogDetails ?? "",
            updatedAt: now,
          })
          .where(eq(changelogEntries.id, existingRows[0].id));
      } else {
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
}

async function replaceResourceTranslations(
  db: ReturnType<typeof getDb>,
  resourceId: string,
  input: ResourceInput,
  now: string,
): Promise<void> {
  for (const locale of ["en", "es"] as const) {
    const translation = input.translations[locale];
    await db
      .insert(resourceTranslations)
      .values({
        id: `${resourceId}-${locale}`,
        resourceId,
        locale,
        title: translation.title,
        shortDescription: translation.shortDescription,
        description: translation.description,
        compatibilityNotes: translation.compatibilityNotes,
        installationInstructions: translation.installationInstructions,
        priceLabel: translation.priceLabel,
        isPublished: translation.isPublished,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          resourceTranslations.resourceId,
          resourceTranslations.locale,
        ],
        set: {
          title: translation.title,
          shortDescription: translation.shortDescription,
          description: translation.description,
          compatibilityNotes: translation.compatibilityNotes,
          installationInstructions: translation.installationInstructions,
          priceLabel: translation.priceLabel,
          isPublished: translation.isPublished,
          revision: sql`${resourceTranslations.revision} + 1`,
          updatedAt: now,
        },
      });
  }
}

async function replacePatreonTiers(
  db: ReturnType<typeof getDb>,
  resourceId: string,
  tierIds: string[],
): Promise<void> {
  await db
    .delete(resourcePatreonTiers)
    .where(eq(resourcePatreonTiers.resourceId, resourceId));
  if (!tierIds.length) return;

  const validRows = await db
    .select({ id: patreonTiers.id })
    .from(patreonTiers)
    .where(inArray(patreonTiers.id, tierIds));
  if (validRows.length) {
    await db
      .insert(resourcePatreonTiers)
      .values(
        validRows.map(({ id }) => ({
          resourceId,
          tierId: id,
        })),
      )
      .onConflictDoNothing();
  }
}

async function ensureSeedData(): Promise<void> {
  await ensureDatabaseSchema();
}

export async function seedExampleDatabase(): Promise<void> {
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
        isPublished: false,
        downloadCount: resource.downloadCount,
        popularityScore: resource.popularityScore,
        publishedAt: null,
        createdAt: resource.publishedAt,
        updatedAt: resource.updatedAt,
      })
      .onConflictDoNothing();

    await db
      .insert(resourceTranslations)
      .values({
        id: `${resource.id}-en`,
        resourceId: resource.id,
        locale: "en",
        title: resource.title,
        shortDescription: resource.shortDescription,
        description: resource.description,
        compatibilityNotes: resource.compatibilityNotes,
        installationInstructions: resource.installationInstructions,
        priceLabel: resource.priceLabel,
        isPublished: false,
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
