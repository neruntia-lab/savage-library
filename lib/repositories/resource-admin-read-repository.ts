import { and, asc, count, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { ensureDatabaseSchema } from "../../db/bootstrap";
import type { WriteDatabase } from "../../db/transaction";
import {
  resources,
  resourceVersions,
  files,
  dependencies,
  resourceTags,
  resourceTranslations,
  resourcePatreonTiers,
} from "../../db/schema";
import { SEED_RESOURCES } from "../data/seed-resources";
import { previewResource } from "../data/preview-resource";
import { isLocalPreview } from "../config/local-preview";
import type { ResourceInput } from "../validation/resource";
import { resolveResourceArtwork } from "../services/resource-artwork";
import { containsPattern, pagination } from "./query-utils";
import { storageImageUrl } from "./resource-mapping";

type AdminListing = {
  query?: string;
  visibility?: string;
  page?: number;
  offset?: number;
};

function adminConditions(input: AdminListing) {
  return and(
    input.query?.trim()
      ? or(
          ilike(resources.title, containsPattern(input.query)),
          ilike(resources.slug, containsPattern(input.query)),
          ilike(resources.resourceType, containsPattern(input.query)),
        )
      : undefined,
    input.visibility === "published"
      ? eq(resources.isPublished, true)
      : input.visibility === "draft"
        ? eq(resources.isPublished, false)
        : input.visibility === "patreon"
          ? eq(resources.accessMode, "patreon")
          : undefined,
  );
}

export async function listAdminResourcePage(input: AdminListing = {}) {
  if (isLocalPreview()) {
    const all = await listAdminResources();
    const matching = all.filter(
      (r) =>
        (!input.query ||
          `${r.title} ${r.slug} ${r.resourceType}`
            .toLowerCase()
            .includes(input.query.toLowerCase())) &&
        (input.visibility === "published"
          ? r.isPublished
          : input.visibility === "draft"
            ? !r.isPublished
            : input.visibility === "patreon"
              ? r.accessMode === "patreon"
              : true),
    );
    const { offset, ...page } = pagination(
      matching.length,
      input.page ?? 1,
      50,
    );
    return {
      ...page,
      resources: matching.slice(offset, offset + 50),
      totals: {
        total: all.length,
        published: all.filter((r) => r.isPublished).length,
        protected: all.filter((r) => r.accessMode === "patreon").length,
        downloads: all.reduce((sum, r) => sum + r.downloadCount, 0),
      },
    };
  }
  const db = getDb();
  const [[matching], [totals]] = await Promise.all([
    db.select({ value: count() }).from(resources).where(adminConditions(input)),
    db
      .select({
        total: count(),
        published: sql<number>`count(*) filter (where ${resources.isPublished})::int`,
        protected: sql<number>`count(*) filter (where ${resources.accessMode} = 'patreon')::int`,
        downloads: sql<number>`coalesce(sum(${resources.downloadCount}), 0)::bigint`,
      })
      .from(resources),
  ]);
  const { offset, ...page } = pagination(matching.value, input.page ?? 1, 50);
  return {
    ...page,
    resources: await listAdminResources({ ...input, offset }),
    totals,
  };
}

export async function adminModuleChoices() {
  if (isLocalPreview())
    return SEED_RESOURCES.filter((r) => r.resourceType === "module").map(
      ({ id, slug, title }) => ({ id, slug, title }),
    );
  return getDb()
    .select({ id: resources.id, slug: resources.slug, title: resources.title })
    .from(resources)
    .where(eq(resources.resourceType, "module"))
    .orderBy(asc(resources.title));
}

export async function listAdminResources(input: AdminListing = {}): Promise<
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
    iconUrl: string | null;
    cardArtworkUrl: string | null;
    useIconEverywhere: boolean;
    revision: number;
    pendingReleaseCount: number;
    setupStatus: "in_progress" | "complete";
    setupStep: number;
  }>
> {
  try {
    await ensureDatabaseSchema();
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
        iconKey: resources.iconKey,
        useIconEverywhere: resources.useIconEverywhere,
        revision: resources.revision,
        setupStatus: resources.setupStatus,
        setupStep: resources.setupStep,
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
      .where(adminConditions(input))
      .orderBy(desc(resources.updatedAt), asc(resources.id))
      .limit(50)
      .offset(input.offset ?? 0)
      .then((rows) =>
        rows.map(
          ({
            thumbnailKey,
            iconKey,
            useIconEverywhere,
            setupStatus,
            ...row
          }) => {
            const artwork = {
              thumbnailUrl: storageImageUrl(thumbnailKey),
              iconUrl: storageImageUrl(iconKey),
              useIconEverywhere,
            };
            return {
              ...row,
              setupStatus:
                setupStatus === "in_progress"
                  ? ("in_progress" as const)
                  : ("complete" as const),
              accessMode: row.accessMode as "public" | "patreon",
              defaultLocale: row.defaultLocale as "en" | "es",
              ...artwork,
              ...resolveResourceArtwork(artwork),
            };
          },
        ),
      );
  } catch {
    if (!isLocalPreview())
      throw new Error("The resource dashboard is temporarily unavailable.");
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
      iconUrl: resource.iconUrl ?? null,
      cardArtworkUrl: resource.cardArtworkUrl ?? null,
      useIconEverywhere: resource.useIconEverywhere ?? false,
      revision: 1,
      pendingReleaseCount: 0,
      setupStatus: "complete" as const,
      setupStep: 1,
    }));
  }
}

export async function getAdminResource(
  id: string,
  transaction?: WriteDatabase,
): Promise<
  | (ResourceInput & {
      id: string;
      resourceVersionId: string;
      coverUrl?: string | null;
      thumbnailUrl?: string | null;
      iconUrl?: string | null;
      heroArtworkUrl?: string | null;
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
      setupStatus?: "in_progress" | "complete";
      setupStep?: number;
      setupCompletedAt?: string | null;
    })
  | null
> {
  if (!transaction && isLocalPreview()) return previewResource(id);
  if (!transaction) await ensureDatabaseSchema();
  const db = transaction ?? getDb();
  const rows = await db
    .select()
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1);
  const resource = rows[0];
  if (!resource) return null;

  const [
    tagRows,
    dependencyRows,
    translationRows,
    tierRows,
    versionRows,
    fileRows,
  ] = await Promise.all([
    db
      .select({ tagId: resourceTags.tagId })
      .from(resourceTags)
      .where(eq(resourceTags.resourceId, id)),
    db.select().from(dependencies).where(eq(dependencies.resourceId, id)),
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
        (locale === "en"
          ? (resource.compatibilityNotes ?? undefined)
          : undefined),
      installationInstructions:
        row?.installationInstructions ??
        (locale === "en"
          ? (resource.installationInstructions ?? undefined)
          : undefined),
      priceLabel:
        row?.priceLabel ??
        (locale === "en" ? (resource.priceLabel ?? undefined) : undefined),
      isPublished:
        row?.isPublished ?? (locale === "en" && resource.isPublished),
    };
  };

  const artwork = {
    coverUrl: storageImageUrl(resource.coverKey),
    thumbnailUrl: storageImageUrl(resource.thumbnailKey),
    iconUrl: storageImageUrl(resource.iconKey),
    useIconEverywhere: resource.useIconEverywhere,
  };
  return {
    id: resource.id,
    ...artwork,
    ...resolveResourceArtwork(artwork),
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
    useIconEverywhere: resource.useIconEverywhere,
    isPublished: resource.isPublished,
    setupStatus: resource.setupStatus as "in_progress" | "complete",
    setupStep: resource.setupStep,
    setupCompletedAt: resource.setupCompletedAt,
  };
}

export async function setResourceSetupState(
  id: string,
  input: { step?: number; status?: "in_progress" | "complete" },
): Promise<boolean> {
  const now = new Date().toISOString();
  const status = input.status;
  const result = await getDb()
    .update(resources)
    .set({
      ...(typeof input.step === "number"
        ? { setupStep: Math.max(1, Math.min(6, Math.trunc(input.step))) }
        : {}),
      ...(status
        ? {
            setupStatus: status,
            setupCompletedAt: status === "complete" ? now : null,
          }
        : {}),
      updatedAt: now,
    })
    .where(eq(resources.id, id))
    .returning({ id: resources.id });
  return Boolean(result[0]);
}

export async function resourceSlugExists(
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const conditions = [eq(resources.slug, slug)];
  if (excludeId) conditions.push(ne(resources.id, excludeId));
  const rows = await getDb()
    .select({ id: resources.id })
    .from(resources)
    .where(and(...conditions))
    .limit(1);
  return Boolean(rows[0]);
}

export async function hasCurrentResourceFile(
  resourceId: string,
  kind: "pdf" | "macro",
): Promise<boolean> {
  const rows = await getDb()
    .select({ id: files.id })
    .from(files)
    .innerJoin(
      resourceVersions,
      eq(files.resourceVersionId, resourceVersions.id),
    )
    .where(
      and(
        eq(resourceVersions.resourceId, resourceId),
        eq(resourceVersions.isCurrent, true),
        eq(files.kind, kind),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}
