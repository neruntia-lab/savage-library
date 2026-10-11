import { getDb } from "../../db";
import { ensureDatabaseSchema } from "../../db/bootstrap";
import {
  authors,
  categories,
  changelogEntries,
  dependencies,
  gameSystems,
  resourceTags,
  resourceTranslations,
  resources,
  resourceVersions,
  tags,
} from "../../db/schema";
import { SEED_RESOURCES } from "../data/seed-resources";

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
        downloadCount: 0,
        popularityScore: 0,
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
