import type { CatalogFacets, ResourceType } from "../domain/resource";
import type { ResourceInput } from "../validation/resource";

export const WIZARD_STEPS = [
  "Choose content",
  "Describe it",
  "Organize it",
  "Release and artwork",
  "Access",
  "Review",
] as const;

const CATEGORY_SLUGS: Record<ResourceType, string> = {
  module: "foundry-modules",
  pdf: "pdfs",
  macro: "macros",
  class: "classes",
  subclass: "subclasses",
};

export function wizardSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function createWizardDraftInput(input: {
  title: string;
  slug: string;
  resourceType: ResourceType;
  defaultLocale: "en" | "es";
  facets: CatalogFacets;
}): ResourceInput {
  const category =
    input.facets.categories.find(
      (item) => item.slug === CATEGORY_SLUGS[input.resourceType],
    ) ?? input.facets.categories[0];
  const author =
    input.facets.authors.find((item) => /savage library/i.test(item.name)) ??
    input.facets.authors[0];
  const system =
    input.facets.gameSystems.find(
      (item) => item.slug === "dnd5e" || /d&d\s*5e/i.test(item.name),
    ) ?? input.facets.gameSystems[0];
  if (!category || !author || !system) {
    throw new Error("Complete the site taxonomy before creating content.");
  }
  const translation = {
    title: input.title,
    shortDescription: "",
    description: "",
    isPublished: false,
  };
  return {
    title: input.title,
    slug: input.slug,
    shortDescription: "",
    description: "",
    resourceType: input.resourceType,
    categoryId: category.id,
    authorId: author.id,
    gameSystemId: system.id,
    currentVersion: "1.0.0",
    compatibilityStatus: "untested",
    pricing: "free",
    tagIds: [],
    dependencies: [],
    defaultLocale: input.defaultLocale,
    accessMode: "public",
    patreonTierIds: [],
    translations: {
      en: input.defaultLocale === "en" ? translation : { ...translation, title: "" },
      es: input.defaultLocale === "es" ? translation : { ...translation, title: "" },
    },
    isFeatured: false,
    useIconEverywhere: false,
    isPublished: false,
  };
}

export type WizardCheck = {
  level: "required" | "recommended" | "confirmed";
  message: string;
  step: number;
};

export function wizardContentChecks(
  resource: ResourceInput,
  capabilities: { hasPrimaryFile: boolean; hasValidatedModuleRelease: boolean },
): WizardCheck[] {
  const checks: WizardCheck[] = [];
  const primary = resource.translations[resource.defaultLocale];
  if (primary.title.trim().length < 2)
    checks.push({ level: "required", message: "Add a public title.", step: 2 });
  else checks.push({ level: "confirmed", message: "Public title is ready.", step: 2 });
  if (primary.shortDescription.trim().length < 10)
    checks.push({ level: "required", message: "Add a short description of at least 10 characters.", step: 2 });
  else checks.push({ level: "confirmed", message: "Short description is ready.", step: 2 });
  if (!primary.description.trim())
    checks.push({ level: "recommended", message: "Add a full description to help visitors understand the content.", step: 2 });
  if (resource.resourceType === "module") {
    if (resource.accessMode === "patreon")
      checks.push({ level: "required", message: "Paid Foundry module distribution is not supported yet.", step: 5 });
    if (!capabilities.hasValidatedModuleRelease)
      checks.push({ level: "required", message: "Upload a valid Foundry module ZIP.", step: 4 });
    else checks.push({ level: "confirmed", message: "Validated Foundry release is ready.", step: 4 });
  } else if (["pdf", "macro"].includes(resource.resourceType)) {
    if (!capabilities.hasPrimaryFile)
      checks.push({ level: "required", message: `Upload the ${resource.resourceType === "pdf" ? "PDF" : "macro file"}.`, step: 4 });
    else checks.push({ level: "confirmed", message: "Primary download is ready.", step: 4 });
  }
  if (resource.accessMode === "patreon" && !resource.patreonTierIds.length)
    checks.push({ level: "required", message: "Choose at least one Patreon tier.", step: 5 });
  else checks.push({ level: "confirmed", message: resource.accessMode === "public" ? "Public access selected." : "Patreon access configured.", step: 5 });
  if (!resource.tagIds.length)
    checks.push({ level: "recommended", message: "Add tags to improve discovery.", step: 3 });
  return checks;
}
