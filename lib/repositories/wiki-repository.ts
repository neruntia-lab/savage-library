import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../../db";
import { resources, wikiGuides } from "../../db/schema";
import { isLocalPreview } from "../config/local-preview";
import { WIKI_EXAMPLES, WIKI_ADMIN_EXAMPLES } from "../data/wiki-examples";
import type { AdminWikiGuide, PublicWikiGuide } from "../domain/wiki";
import {
  resolveResourceArtwork,
  publicWikiArtworkUrl,
} from "../services/resource-artwork";
import {
  WikiError,
  validateWikiInput,
  wikiPublicationFields,
  browseWiki,
} from "../services/wiki";
import { containsPattern, pagination } from "./query-utils";

function adminGuide(row: typeof wikiGuides.$inferSelect): AdminWikiGuide {
  return {
    id: row.id,
    slug: row.slug,
    draft: row.draft,
    moduleId: row.moduleId,
    starterResourceId: row.starterResourceId,
    isPublished: Boolean(row.publishedContent),
    revision: row.revision,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  };
}

export async function listPublicWiki(
  options: { slug?: string; where?: SQL; limit?: number; offset?: number } = {},
): Promise<PublicWikiGuide[]> {
  if (isLocalPreview())
    return WIKI_EXAMPLES.filter(
      (g) => !options.slug || g.slug === options.slug,
    );
  if (!isDatabaseConfigured())
    throw new Error("Wiki is temporarily unavailable.");
  // Deliberately select only the published snapshot: drafts never reach public page data.
  const rows = await getDb()
    .select({
      id: wikiGuides.id,
      slug: wikiGuides.publishedSlug,
      content: wikiGuides.publishedContent,
      publishedAt: wikiGuides.publishedAt,
      moduleId: resources.id,
      moduleSlug: resources.slug,
      moduleTitle: resources.title,
      modulePublished: resources.isPublished,
      moduleThumbnail: resources.thumbnailKey,
      moduleIcon: resources.iconKey,
      moduleUseIconEverywhere: resources.useIconEverywhere,
    })
    .from(wikiGuides)
    .leftJoin(resources, eq(wikiGuides.publishedModuleId, resources.id))
    .where(
      and(
        isNotNull(wikiGuides.publishedContent),
        options.slug ? eq(wikiGuides.publishedSlug, options.slug) : undefined,
        options.where,
      ),
    )
    .orderBy(desc(wikiGuides.publishedAt), asc(wikiGuides.id))
    .limit(options.limit ?? 20)
    .offset(options.offset ?? 0);
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug!,
    content: row.content!,
    publishedAt: row.publishedAt!,
    module:
      row.moduleId && row.modulePublished
        ? {
            id: row.moduleId,
            slug: row.moduleSlug!,
            title: row.moduleTitle!,
            cardArtworkUrl: resolveResourceArtwork({
              thumbnailUrl: publicWikiArtworkUrl(row.moduleThumbnail),
              iconUrl: publicWikiArtworkUrl(row.moduleIcon),
              useIconEverywhere: row.moduleUseIconEverywhere ?? false,
            }).cardArtworkUrl,
          }
        : null,
  }));
}

export async function getPublicWikiBySlug(slug: string) {
  return (await listPublicWiki({ slug, limit: 1 }))[0] ?? null;
}

export async function browsePublicWiki(
  query: string,
  moduleId: string,
  requestedPage: number,
) {
  if (isLocalPreview())
    return browseWiki(WIKI_EXAMPLES, query, moduleId, requestedPage);
  const search = containsPattern(query);
  const translationSearch = sql<string>`concat_ws(' ', ${wikiGuides.publishedContent}->'translations'->'en'->>'title', ${wikiGuides.publishedContent}->'translations'->'en'->>'summary', ${wikiGuides.publishedContent}->'translations'->'en'->>'body', ${wikiGuides.publishedContent}->'translations'->'es'->>'title', ${wikiGuides.publishedContent}->'translations'->'es'->>'summary', ${wikiGuides.publishedContent}->'translations'->'es'->>'body')`;
  const where = and(
    isNotNull(wikiGuides.publishedContent),
    query.trim()
      ? or(
          ilike(translationSearch, search),
          and(eq(resources.isPublished, true), ilike(resources.title, search)),
        )
      : undefined,
    moduleId === "general"
      ? or(sql`${resources.id} IS NULL`, eq(resources.isPublished, false))
      : moduleId
        ? and(eq(resources.id, moduleId), eq(resources.isPublished, true))
        : undefined,
  );
  const [totals] = await getDb()
    .select({ total: count() })
    .from(wikiGuides)
    .leftJoin(resources, eq(wikiGuides.publishedModuleId, resources.id))
    .where(where);
  const { offset, ...page } = pagination(totals.total, requestedPage, 20);
  return { ...page, items: await listPublicWiki({ where, limit: 20, offset }) };
}

export async function publicWikiModules() {
  if (isLocalPreview())
    return Array.from(
      new Map(
        WIKI_EXAMPLES.filter((g) => g.module).map((g) => [
          g.module!.id,
          g.module!,
        ]),
      ).values(),
    );
  return getDb()
    .selectDistinct({ id: resources.id, title: resources.title })
    .from(wikiGuides)
    .innerJoin(resources, eq(wikiGuides.publishedModuleId, resources.id))
    .where(
      and(
        isNotNull(wikiGuides.publishedContent),
        eq(resources.isPublished, true),
      ),
    )
    .orderBy(asc(resources.title));
}

export async function listAdminWiki(
  input: { query?: string; filter?: string; page?: number } = {},
) {
  const query = input.query?.trim().slice(0, 120) ?? "";
  if (isLocalPreview()) {
    const matching = WIKI_ADMIN_EXAMPLES.filter(
      (g) =>
        `${g.slug} ${Object.values(g.draft.translations)
          .map((t) => t.title)
          .join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (input.filter === "published"
          ? g.isPublished
          : input.filter === "draft"
            ? !g.isPublished
            : true),
    );
    const { offset, ...page } = pagination(
      matching.length,
      input.page ?? 1,
      20,
    );
    return { ...page, guides: matching.slice(offset, offset + 20) };
  }
  const where = and(
    query
      ? or(
          ilike(wikiGuides.slug, containsPattern(query)),
          ilike(
            sql<string>`concat_ws(' ', ${wikiGuides.draft}->'translations'->'en'->>'title', ${wikiGuides.draft}->'translations'->'es'->>'title')`,
            containsPattern(query),
          ),
        )
      : undefined,
    input.filter === "published"
      ? isNotNull(wikiGuides.publishedContent)
      : input.filter === "draft"
        ? sql`${wikiGuides.publishedContent} IS NULL`
        : undefined,
  );
  const db = getDb();
  const [totals] = await db
    .select({ total: count() })
    .from(wikiGuides)
    .where(where);
  const { offset, ...page } = pagination(totals.total, input.page ?? 1, 20);
  return {
    ...page,
    guides: (
      await db
        .select()
        .from(wikiGuides)
        .where(where)
        .orderBy(desc(wikiGuides.updatedAt), asc(wikiGuides.id))
        .limit(20)
        .offset(offset)
    ).map(adminGuide),
  };
}

export async function getAdminWiki(id: string) {
  if (isLocalPreview())
    return WIKI_ADMIN_EXAMPLES.find((g) => g.id === id) ?? null;
  const [row] = await getDb()
    .select()
    .from(wikiGuides)
    .where(eq(wikiGuides.id, id))
    .limit(1);
  return row ? adminGuide(row) : null;
}

export async function saveWiki(
  value: unknown,
  administrator: string,
  id?: string,
): Promise<AdminWikiGuide> {
  if (isLocalPreview())
    throw new WikiError(
      "Local preview is read-only. Connect a separate development database to save guides.",
      503,
    );
  const input = value as Record<string, unknown> | null;
  const action = input?.action ?? "draft";
  if (!["draft", "publish", "unpublish"].includes(String(action)))
    throw new WikiError("Invalid guide action.");
  if (!id && action !== "draft")
    throw new WikiError("Save the new guide as a draft first.");
  if (id && !Number.isInteger(input?.revision))
    throw new WikiError("Reload this guide before saving.", 409);
  const data = validateWikiInput(value, action === "publish");
  const db = getDb();
  if (data.moduleId) {
    const [module] = await db
      .select({ id: resources.id })
      .from(resources)
      .where(
        and(
          eq(resources.id, data.moduleId),
          eq(resources.resourceType, "module"),
        ),
      )
      .limit(1);
    if (!module)
      throw new WikiError("Choose an existing Foundry module.", 400, {
        moduleId: "This module no longer exists.",
      });
  }
  const collision = await db
    .select({ id: wikiGuides.id })
    .from(wikiGuides)
    .where(
      and(
        or(
          eq(wikiGuides.slug, data.slug),
          eq(wikiGuides.publishedSlug, data.slug),
        ),
        id ? ne(wikiGuides.id, id) : undefined,
      ),
    )
    .limit(1);
  if (collision.length)
    throw new WikiError("That guide slug is already in use.", 409, {
      slug: "Choose a unique slug.",
    });
  const now = new Date().toISOString();
  const common = {
    slug: data.slug,
    draft: data.content,
    moduleId: data.moduleId,
    updatedBy: administrator,
    updatedAt: now,
  };
  const publication = wikiPublicationFields(
    action as "draft" | "publish" | "unpublish",
    data,
    now,
  );
  // One UPDATE atomically promotes content, translations, URL, and module association.
  const [row] = id
    ? await db
        .update(wikiGuides)
        .set({
          ...common,
          ...publication,
          revision: sql`${wikiGuides.revision} + 1`,
        })
        .where(
          and(
            eq(wikiGuides.id, id),
            eq(wikiGuides.revision, input!.revision as number),
          ),
        )
        .returning()
    : await db
        .insert(wikiGuides)
        .values({ ...common, id: randomUUID(), createdAt: now })
        .returning();
  if (!row)
    throw new WikiError(
      "This guide changed in another session. Reload it before saving again.",
      409,
    );
  return adminGuide(row);
}
