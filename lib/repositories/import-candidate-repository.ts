import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import {
  authors,
  categories,
  gameSystems,
  patreonPosts,
  protectedPostLinks,
  resources,
  tags,
} from "../../db/schema";
import {
  createResource,
  getAdminResource,
  updateResource,
} from "./resource-repository";
import type { PatreonImportPayload } from "../services/patreon-posts";
import type { ResourceInput } from "../validation/resource";

export async function listImportCandidates() {
  const db = getDb();
  const rows = await db
    .select()
    .from(patreonPosts)
    .orderBy(desc(patreonPosts.publishedAt));
  const links = await db
    .select({
      id: protectedPostLinks.id,
      postId: protectedPostLinks.postId,
      label: protectedPostLinks.label,
      role: protectedPostLinks.role,
      destination: protectedPostLinks.destination,
    })
    .from(protectedPostLinks);
  const resourceRows = await db
    .select({
      id: resources.id,
      title: resources.title,
      resourceType: resources.resourceType,
      currentVersion: resources.currentVersion,
      manifestUrl: resources.manifestUrl,
      projectUrl: resources.projectUrl,
      shortDescription: resources.shortDescription,
    })
    .from(resources);
  return rows.map((row) => ({
    ...row,
    payload: parseJson<PatreonImportPayload>(row.extractedPayload, {
      title: row.title,
      description: "",
      shortDescription: "",
      version: "1.0.0",
      tags: [],
    }),
    warnings: parseJson<string[]>(row.warnings, []),
    tierIds: parseJson<string[]>(row.requiredTierIds, []),
    matchedResource:
      resourceRows.find((resource) => resource.id === row.resourceId) ?? null,
    links: links
      .filter((link) => link.postId === row.id)
      .map((link) => ({
        id: link.id,
        label: link.label,
        role: link.role,
        destination: link.destination,
      })),
  }));
}

export async function updateImportCandidate(
  id: string,
  input: {
    payload?: PatreonImportPayload;
    resourceId?: string | null;
    status?: "pending" | "needs_review" | "rejected";
  },
) {
  const now = new Date().toISOString();
  const rows = await getDb()
    .update(patreonPosts)
    .set({
      ...(input.payload
        ? {
            extractedPayload: JSON.stringify(input.payload),
            detectedType: input.payload.resourceType ?? null,
          }
        : {}),
      ...(input.resourceId !== undefined ? { resourceId: input.resourceId } : {}),
      ...(input.status ? { reviewStatus: input.status } : {}),
      ...(input.status === "rejected" ? { rejectedAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(patreonPosts.id, id))
    .returning({ id: patreonPosts.id });
  return Boolean(rows[0]);
}

export async function approveImportCandidate(id: string) {
  const db = getDb();
  const candidate = (
    await db.select().from(patreonPosts).where(eq(patreonPosts.id, id)).limit(1)
  )[0];
  if (!candidate) throw new Error("Import candidate was not found.");
  if (candidate.reviewStatus === "source_deleted") {
    throw new Error("A deleted Patreon source cannot be approved.");
  }
  const payload = parseJson<PatreonImportPayload | null>(
    candidate.extractedPayload,
    null,
  );
  if (!payload?.resourceType) throw new Error("Choose a content type before approval.");

  await ensureImportTaxonomy(payload.tags);
  const tierIds = parseJson<string[]>(candidate.requiredTierIds, []);
  const resourceId = candidate.resourceId;
  const existing = resourceId ? await getAdminResource(resourceId) : null;
  const slug = payload.resourceKey || slugify(payload.title);
  const categoryId =
    payload.resourceType === "module"
      ? "category-foundry-modules"
      : payload.resourceType === "pdf"
        ? "category-pdfs"
        : "category-macros";
  const tagIds = payload.tags.map((tag) => `tag-${slugify(tag)}`).filter((id) => id !== "tag-");
  const accessMode = tierIds.length ? "patreon" : "public";
  const base: ResourceInput = existing ?? {
    title: payload.title,
    slug,
    shortDescription: payload.shortDescription || payload.description.slice(0, 240),
    description: payload.description,
    resourceType: payload.resourceType,
    categoryId,
    authorId: "author-savage-library",
    gameSystemId: "system-dnd5e",
    currentVersion: payload.version || "1.0.0",
    compatibilityStatus: "untested",
    pricing: tierIds.length ? "premium" : "free",
    tagIds,
    dependencies: [],
    defaultLocale: "en",
    accessMode,
    patreonTierIds: tierIds,
    translations: {
      en: {
        title: payload.title,
        shortDescription: payload.shortDescription || payload.description.slice(0, 240),
        description: payload.description,
        isPublished: false,
      },
      es: { title: "", shortDescription: "", description: "", isPublished: false },
    },
    isFeatured: false,
    isPublished: false,
  };
  const input: ResourceInput = {
    ...base,
    title: payload.title,
    slug: existing?.slug ?? slug,
    shortDescription: payload.shortDescription || payload.description.slice(0, 240),
    description: payload.description,
    resourceType: payload.resourceType,
    categoryId,
    currentVersion: payload.version || "1.0.0",
    foundryMinimum: payload.foundryMinimum,
    foundryVerified: payload.foundryVerified,
    foundryMaximum: payload.foundryMaximum,
    manifestUrl: payload.manifestUrl,
    projectUrl: payload.projectUrl,
    pricing: tierIds.length ? "premium" : base.pricing,
    accessMode,
    patreonTierIds: tierIds,
    tagIds: Array.from(new Set([...base.tagIds, ...tagIds])),
    translations: {
      ...base.translations,
      en: {
        ...base.translations.en,
        title: payload.title,
        shortDescription: payload.shortDescription || payload.description.slice(0, 240),
        description: payload.description,
        isPublished: base.translations.en.isPublished,
      },
    },
    isPublished: existing?.isPublished ?? false,
  };

  const approvedResourceId = existing
    ? (await updateResource(existing.id, input), existing.id)
    : await createResource(input);
  const now = new Date().toISOString();
  await db
    .update(resources)
    .set({
      sourcePatreonPostId: candidate.id,
      lastApprovedCandidateId: candidate.id,
      updatedAt: now,
    })
    .where(eq(resources.id, approvedResourceId));
  await db
    .update(patreonPosts)
    .set({
      resourceId: approvedResourceId,
      reviewStatus: "approved",
      approvedAt: now,
      rejectedAt: null,
      updatedAt: now,
    })
    .where(eq(patreonPosts.id, id));
  return approvedResourceId;
}

async function ensureImportTaxonomy(tagNames: string[]) {
  const db = getDb();
  await db
    .insert(authors)
    .values({
      id: "author-savage-library",
      name: "Savage Library",
      slug: "savage-library",
    })
    .onConflictDoNothing();
  await db
    .insert(gameSystems)
    .values({ id: "system-dnd5e", name: "D&D 5e", slug: "dnd5e" })
    .onConflictDoNothing();
  await db
    .insert(categories)
    .values([
      {
        id: "category-foundry-modules",
        name: "Foundry VTT Modules",
        slug: "foundry-modules",
        description: "Installable Foundry VTT packages and manifests.",
      },
      { id: "category-pdfs", name: "PDFs", slug: "pdfs", description: "Printable resources." },
      {
        id: "category-macros",
        name: "Macros",
        slug: "macros",
        description: "Ready-to-use Foundry VTT automations and scripts.",
      },
    ])
    .onConflictDoNothing();
  const values = tagNames
    .map((name) => ({ id: `tag-${slugify(name)}`, name, slug: slugify(name) }))
    .filter((tag) => tag.slug);
  if (values.length) await db.insert(tags).values(values).onConflictDoNothing();
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}
