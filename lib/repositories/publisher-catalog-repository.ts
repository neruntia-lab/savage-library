import { eq, or, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { authors, categories, gameSystems, resources, tags } from "../../db/schema";
import { CANONICAL_SITE_ORIGIN, foundryManifestUrl } from "../config/site";
import { getAdminResource, createResource, updateResource } from "./resource-repository";
import { publishRelease, rotatePublisherToken } from "./publisher-repository";
import { validateResourceInput, type ResourceInput } from "../validation/resource";
import { validateReleaseNotes, type ReleaseNotes } from "../validation/release-notes";

type CatalogConfig = {
  slug?: string;
  title?: string;
  shortDescription?: string;
  description?: string;
  author?: string;
  category?: string;
  system?: string;
  tags?: string[];
  compatibilityStatus?: ResourceInput["compatibilityStatus"];
  pricing?: ResourceInput["pricing"];
  accessMode?: ResourceInput["accessMode"];
  defaultLocale?: ResourceInput["defaultLocale"];
  installationInstructions?: string;
  projectUrl?: string;
  licenseName?: string;
};

type ModuleMetadata = {
  id: string;
  title: string;
  description: string;
  version: string;
  compatibility?: { minimum?: string; verified?: string; maximum?: string };
  url?: string;
};

export class PublisherCatalogError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}

export async function synchronizePublisherCatalog(input: {
  module: ModuleMetadata;
  resource: CatalogConfig;
  release?: unknown;
  expectedRevision?: number;
  needsPublisherToken?: boolean;
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const db = getDb();
  const slug = input.resource.slug?.trim() || input.module.id;
  const normalizedTitle = (input.resource.title?.trim() || input.module.title).toLowerCase();
  const matches = await db
    .select({ id: resources.id, foundryModuleId: resources.foundryModuleId, slug: resources.slug, title: resources.title, revision: resources.revision, currentVersion: resources.currentVersion, activeReleaseId: resources.activeReleaseId })
    .from(resources)
    .where(or(eq(resources.foundryModuleId, input.module.id), eq(resources.slug, slug), sql`lower(${resources.title}) = ${normalizedTitle}`));
  const unique = Array.from(new Map(matches.map((row) => [row.id, row])).values());
  if (unique.length > 1) throw new PublisherCatalogError("catalog_match_ambiguous", 409, "The module id, slug, and title match different resources. Resolve the conflict in the admin dashboard.");

  let resourceId = unique[0]?.id;
  let created = false;
  let releaseNotes: ReleaseNotes | undefined;
  const requiresPatchNotes = Boolean(unique[0]?.activeReleaseId) || Boolean(unique[0] && unique[0].currentVersion !== input.module.version);
  if (requiresPatchNotes || input.release !== undefined) {
    const notes = validateReleaseNotes(input.release, input.module.version);
    if (!notes.success) throw new PublisherCatalogError("release_notes_invalid", 400, notes.errors.join(" "));
    releaseNotes = notes.data;
  }
  if (!resourceId && !input.canCreate) throw new PublisherCatalogError("scope_missing", 403, "This token cannot create catalog resources.");
  if (resourceId && !input.canUpdate) throw new PublisherCatalogError("scope_missing", 403, "This token cannot update catalog resources.");
  if (unique[0]?.foundryModuleId && unique[0].foundryModuleId !== input.module.id) {
    throw new PublisherCatalogError("module_resource_mismatch", 409, `The matched resource belongs to module id "${unique[0].foundryModuleId}".`);
  }
  if (resourceId && input.expectedRevision !== undefined && unique[0]?.revision !== input.expectedRevision) {
    throw new PublisherCatalogError("resource_revision_conflict", 409, "The catalog resource changed since the CLI last synchronized it. Run release again after reviewing the current resource.");
  }

  const taxonomy = await resolveTaxonomy(input.resource);
  const existing = resourceId ? await getAdminResource(resourceId) : null;
  const title = input.resource.title ?? existing?.title ?? input.module.title;
  const description = input.resource.description ?? existing?.description ?? input.module.description;
  const shortDescription = input.resource.shortDescription ?? existing?.shortDescription ?? plainDescription(description).slice(0, 240);
  const merged: unknown = {
    ...(existing ?? {}),
    title,
    slug,
    shortDescription,
    description,
    resourceType: "module",
    categoryId: taxonomy.categoryId ?? existing?.categoryId,
    authorId: taxonomy.authorId ?? existing?.authorId,
    gameSystemId: taxonomy.gameSystemId ?? existing?.gameSystemId,
    tagIds: taxonomy.tagIds ?? existing?.tagIds ?? [],
    currentVersion: existing?.currentVersion ?? input.module.version,
    foundryMinimum: input.module.compatibility?.minimum ?? existing?.foundryMinimum,
    foundryVerified: input.module.compatibility?.verified ?? existing?.foundryVerified,
    foundryMaximum: input.module.compatibility?.maximum ?? existing?.foundryMaximum,
    compatibilityStatus: input.resource.compatibilityStatus ?? existing?.compatibilityStatus ?? "untested",
    pricing: input.resource.pricing ?? existing?.pricing ?? "free",
    accessMode: input.resource.accessMode ?? existing?.accessMode ?? "public",
    defaultLocale: input.resource.defaultLocale ?? existing?.defaultLocale ?? "en",
    installationInstructions: input.resource.installationInstructions ?? existing?.installationInstructions,
    projectUrl: input.resource.projectUrl ?? existing?.projectUrl ?? input.module.url,
    licenseName: input.resource.licenseName ?? existing?.licenseName,
    manifestUrl: foundryManifestUrl(slug),
    dependencies: existing?.dependencies ?? [],
    patreonTierIds: existing?.patreonTierIds ?? [],
    translations: existing?.translations ?? {
      en: { title, shortDescription, description, isPublished: false },
      es: { title: "", shortDescription: "", description: "", isPublished: false },
    },
    isFeatured: existing?.isFeatured ?? false,
    useIconEverywhere: existing?.useIconEverywhere ?? false,
    isPublished: existing?.isPublished ?? false,
  };
  if (input.resource.title || input.resource.shortDescription || input.resource.description) {
    const translations = (merged as ResourceInput).translations;
    translations.en = { ...translations.en, title, shortDescription, description };
  }
  const validation = validateResourceInput(merged);
  if (!validation.success) throw new PublisherCatalogError("catalog_validation_failed", 400, Object.values(validation.errors).join(" "));
  if (resourceId) await updateResource(resourceId, validation.data);
  else {
    resourceId = await createResource(validation.data);
    created = true;
  }
  await db.update(resources).set({ foundryModuleId: input.module.id, manifestUrl: foundryManifestUrl(slug), updatedAt: new Date().toISOString() }).where(eq(resources.id, resourceId));
  const current = await db.select({ revision: resources.revision, title: resources.title, slug: resources.slug }).from(resources).where(eq(resources.id, resourceId)).limit(1);
  const publisherToken = input.needsPublisherToken || created ? await rotatePublisherToken(resourceId) : undefined;
  return { resourceId, ...current[0], created, requiresPatchNotes, releaseNotes, publisherToken, reviewUrl: `${CANONICAL_SITE_ORIGIN}/admin/resources/${resourceId}#module-releases` };
}

export async function publishPublisherCatalogRelease(resourceId: string, releaseId: string) {
  const db = getDb();
  await publishRelease(resourceId, releaseId, CANONICAL_SITE_ORIGIN, { publishCatalog: true });
  return { manifestUrl: `${CANONICAL_SITE_ORIGIN}/api/foundry/modules/${(await db.select({ slug: resources.slug }).from(resources).where(eq(resources.id, resourceId)).limit(1))[0]?.slug}/module.json` };
}

async function resolveTaxonomy(config: CatalogConfig) {
  const db = getDb();
  const [authorRows, categoryRows, systemRows, tagRows] = await Promise.all([
    db.select().from(authors), db.select().from(categories), db.select().from(gameSystems), db.select().from(tags),
  ]);
  const find = <T extends { id: string; slug: string }>(items: T[], slug: string | undefined, label: string) => {
    if (!slug) return undefined;
    const item = items.find((entry) => entry.slug === slug);
    if (!item) throw new PublisherCatalogError("taxonomy_not_found", 400, `Unknown ${label} slug "${slug}". Valid values: ${items.map((entry) => entry.slug).join(", ")}.`);
    return item.id;
  };
  return {
    authorId: find(authorRows, config.author, "author"),
    categoryId: find(categoryRows, config.category, "category"),
    gameSystemId: find(systemRows, config.system, "game system"),
    tagIds: config.tags ? config.tags.map((slug) => find(tagRows, slug, "tag") as string) : undefined,
  };
}

function plainDescription(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
