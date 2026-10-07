import type { EditingResource } from "../../components/admin/types";
import { SEED_RESOURCES } from "./seed-resources";

/** Read-only fixtures are reachable only through the explicit local preview guard. */
export function previewResource(id: string): EditingResource | null {
  const resource = SEED_RESOURCES.find((item) => item.id === id);
  if (!resource) return null;
  return {
    ...resource,
    categoryId: resource.category.id,
    authorId: resource.author.id,
    className: resource.className ?? undefined,
    subclassName: resource.subclassName ?? undefined,
    foundryMinimum: resource.foundryMinimum ?? undefined,
    foundryVerified: resource.foundryVerified ?? undefined,
    foundryMaximum: resource.foundryMaximum ?? undefined,
    compatibilityNotes: resource.compatibilityNotes ?? undefined,
    priceLabel: resource.priceLabel ?? undefined,
    licenseName: resource.licenseName ?? undefined,
    manifestUrl: resource.manifestUrl ?? undefined,
    projectUrl: resource.projectUrl ?? undefined,
    installationInstructions: resource.installationInstructions ?? undefined,
    gameSystemId: resource.gameSystem.id,
    tagIds: resource.tags.map((tag) => tag.id),
    defaultLocale: "en",
    accessMode: resource.accessMode ?? "public",
    patreonTierIds: [],
    useIconEverywhere: false,
    isPublished: false,
    resourceVersionId: `preview-${resource.id}`,
    coverUrl: null,
    thumbnailUrl: null,
    iconUrl: null,
    heroArtworkUrl: null,
    setupStatus: "complete",
    setupStep: 2,
    setupCompletedAt: null,
    files: resource.files.map((file) => ({
      id: file.id,
      kind: file.kind,
      locale: "en",
      originalName: file.name,
      sizeBytes: file.sizeBytes,
    })),
    releases: [],
    dependencies: resource.dependencies.map((dependency) => ({
      name: dependency.name,
      versionRange: dependency.versionRange ?? undefined,
      url: dependency.url ?? undefined,
      isRequired: dependency.isRequired,
    })),
    translations: {
      en: {
        title: resource.title,
        shortDescription: resource.shortDescription,
        description: resource.description,
        isPublished: true,
      },
      es: {
        title: "",
        shortDescription: "",
        description: "",
        isPublished: false,
      },
    },
  };
}
