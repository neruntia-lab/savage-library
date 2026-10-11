import { and, asc, desc, eq, inArray, like } from "drizzle-orm";
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
} from "../domain/resource";
import { filterCatalog, type CatalogListingOptions } from "../services/catalog";
import { resolveResourceArtwork } from "../services/resource-artwork";
import { isLocalPreview } from "../config/local-preview";
import { previewCatalog } from "../data/preview-catalog";
import { listCatalogFromDatabase } from "./catalog-repository";
import { mapSummary, storageImageUrl } from "./resource-mapping";

export async function listCatalog(
  filters: CatalogFilters,
  options: CatalogListingOptions = {},
): Promise<CatalogResult> {
  try {
    await ensureDatabaseSchema();
    return await listCatalogFromDatabase(filters, options);
  } catch {
    if (!isLocalPreview())
      throw new Error("The catalog is temporarily unavailable.");
    return filterCatalog(previewCatalog(), filters, options);
  }
}

export async function getResourceBySlug(
  slug: string,
  requestedLocale?: "en" | "es",
): Promise<ResourceDetails | null> {
  return getResourceDetails({ slug, requestedLocale, publishedOnly: true });
}

export async function getResourcePreview(
  id: string,
  requestedLocale?: "en" | "es",
): Promise<ResourceDetails | null> {
  return getResourceDetails({ id, requestedLocale, publishedOnly: false });
}

async function getResourceDetails(input: {
  slug?: string;
  id?: string;
  requestedLocale?: "en" | "es";
  publishedOnly: boolean;
}): Promise<ResourceDetails | null> {
  if (isLocalPreview()) {
    const fixture = SEED_RESOURCES.find((resource) =>
      input.id ? resource.id === input.id : resource.slug === input.slug,
    );
    return fixture
      ? { ...fixture, activeLocale: "en", availableLocales: ["en"] }
      : null;
  }
  try {
    await ensureDatabaseSchema();
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
      .where(
        and(
          input.id
            ? eq(resources.id, input.id)
            : eq(resources.slug, input.slug ?? ""),
          input.publishedOnly ? eq(resources.isPublished, true) : undefined,
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const translationRows = await db
      .select()
      .from(resourceTranslations)
      .where(
        and(
          eq(resourceTranslations.resourceId, row.resource.id),
          input.publishedOnly
            ? eq(resourceTranslations.isPublished, true)
            : undefined,
        ),
      );
    const defaultLocale =
      row.resource.defaultLocale === "es" ? ("es" as const) : ("en" as const);
    const activeTranslation =
      translationRows.find(
        (translation) => translation.locale === input.requestedLocale,
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

    const [
      tagRows,
      fileRows,
      dependencyRows,
      changelogRows,
      tierRows,
      protectedRows,
    ] = await Promise.all([
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
        .innerJoin(patreonPosts, eq(protectedPostLinks.postId, patreonPosts.id))
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

    const artwork = {
      coverUrl: storageImageUrl(row.resource.coverKey),
      iconUrl: storageImageUrl(row.resource.iconKey),
      thumbnailUrl: storageImageUrl(row.resource.thumbnailKey),
      useIconEverywhere: row.resource.useIconEverywhere,
    };
    return {
      ...mapSummary(
        row,
        tagRows.map((entry) => entry.tag),
      ),
      title: activeTranslation?.title || row.resource.title,
      shortDescription:
        activeTranslation?.shortDescription || row.resource.shortDescription,
      description: activeTranslation?.description || row.resource.description,
      compatibilityNotes:
        activeTranslation?.compatibilityNotes ??
        row.resource.compatibilityNotes,
      ...artwork,
      ...resolveResourceArtwork(artwork),
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
      accessMode: row.resource.accessMode === "patreon" ? "patreon" : "public",
      defaultLocale,
      activeLocale,
      availableLocales: translationRows
        .map((translation) => translation.locale)
        .filter(
          (locale): locale is "en" | "es" => locale === "en" || locale === "es",
        ),
      allowedPatreonTiers: tierRows,
      protectedDownloads: protectedRows,
    };
  } catch {
    if (!isLocalPreview())
      throw new Error("Resource information is temporarily unavailable.");
    return input.publishedOnly && input.slug
      ? (SEED_RESOURCES.find((resource) => resource.slug === input.slug) ??
          null)
      : null;
  }
}

export async function getCatalogFacets(): Promise<CatalogFacets> {
  try {
    await ensureDatabaseSchema();
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
    if (!isLocalPreview())
      throw new Error("Catalog filters are temporarily unavailable.");
    return SEED_FACETS;
  }
}

export {
  createResource,
  updateResource,
  setResourcePublication,
  deleteResource,
  getResourceStorageKeys,
} from "./resource-write-repository";

export { listCatalogFromDatabase } from "./catalog-repository";
export {
  listAdminResourcePage,
  adminModuleChoices,
  listAdminResources,
  getAdminResource,
  setResourceSetupState,
  resourceSlugExists,
  hasCurrentResourceFile,
} from "./resource-admin-read-repository";
export { seedExampleDatabase } from "./resource-seed";
