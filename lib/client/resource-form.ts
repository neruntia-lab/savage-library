import type { ResourceInput } from "../validation/resource";

export function buildResourcePayload(
  formData: FormData,
  dependencies: ResourceInput["dependencies"],
  accessMode: "public" | "patreon",
  isPublished: boolean,
) {
  const value = (name: string) => String(formData.get(name) ?? "");
  const translation = (locale: "en" | "es") => ({
    title: value(`${locale}Title`),
    shortDescription: value(`${locale}ShortDescription`),
    description: value(`${locale}Description`),
    compatibilityNotes: value(`${locale}CompatibilityNotes`),
    installationInstructions: value(`${locale}InstallationInstructions`),
    isPublished: formData.get(`${locale}Published`) === "on",
  });
  const translations = { en: translation("en"), es: translation("es") };
  const defaultLocale = value("defaultLocale") === "es" ? "es" : "en";
  const primary = translations[defaultLocale].title.trim()
    ? translations[defaultLocale]
    : translations.en;

  return {
    title: value("title") || primary.title,
    slug: value("slug"),
    shortDescription: primary.shortDescription,
    description: primary.description,
    resourceType: value("resourceType"),
    categoryId: value("categoryId"),
    authorId: value("authorId"),
    gameSystemId: value("gameSystemId"),
    className: value("className"),
    subclassName: value("subclassName"),
    currentVersion: value("currentVersion"),
    foundryMinimum: value("foundryMinimum"),
    foundryVerified: value("foundryVerified"),
    foundryMaximum: value("foundryMaximum"),
    compatibilityStatus: value("compatibilityStatus"),
    compatibilityNotes: primary.compatibilityNotes,
    pricing: value("pricing"),
    manifestUrl: value("manifestUrl"),
    projectUrl: value("projectUrl"),
    licenseName: value("licenseName"),
    installationInstructions: primary.installationInstructions,
    tagIds: formData.getAll("tagIds"),
    dependencies,
    changelogSummary: value("changelogSummary"),
    changelogDetails: value("changelogDetails"),
    defaultLocale,
    accessMode,
    patreonTierIds: formData.getAll("patreonTierIds"),
    translations,
    isFeatured: formData.get("isFeatured") === "on",
    useIconEverywhere: formData.get("useIconEverywhere") === "on",
    isPublished,
  };
}
