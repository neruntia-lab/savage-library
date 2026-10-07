import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { ensureDatabaseSchema } from "../../db/bootstrap";
import {
  changelogEntries,
  dependencies,
  files,
  patreonTiers,
  resourcePatreonTiers,
  resourceTags,
  resourceTranslations,
  resources,
  resourceVersions,
} from "../../db/schema";
import type { ResourceInput } from "../validation/resource";

export async function createResource(input: ResourceInput): Promise<string> {
  await ensureDatabaseSchema();
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
    useIconEverywhere: input.useIconEverywhere,
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
  await ensureDatabaseSchema();
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
      useIconEverywhere: input.useIconEverywhere,
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
        target: [resourceTranslations.resourceId, resourceTranslations.locale],
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
