import {
  COMPATIBILITY_STATUSES,
  PRICING_TYPES,
  RESOURCE_TYPES,
  type CompatibilityStatus,
  type PricingType,
  type ResourceType,
} from "../domain/resource";
import { foundryManifestUrl } from "../config/site";

export type ResourceInput = {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  resourceType: ResourceType;
  categoryId: string;
  authorId: string;
  gameSystemId: string;
  className?: string;
  subclassName?: string;
  currentVersion: string;
  foundryMinimum?: string;
  foundryVerified?: string;
  foundryMaximum?: string;
  compatibilityStatus: CompatibilityStatus;
  compatibilityNotes?: string;
  pricing: PricingType;
  priceLabel?: string;
  manifestUrl?: string;
  projectUrl?: string;
  licenseName?: string;
  installationInstructions?: string;
  tagIds: string[];
  dependencies: Array<{
    name: string;
    versionRange?: string;
    url?: string;
    isRequired: boolean;
  }>;
  changelogSummary?: string;
  changelogDetails?: string;
  defaultLocale: "en" | "es";
  accessMode: "public" | "patreon";
  patreonTierIds: string[];
  translations: {
    en: ResourceTranslationInput;
    es: ResourceTranslationInput;
  };
  isFeatured: boolean;
  isPublished: boolean;
};

export type ResourceTranslationInput = {
  title: string;
  shortDescription: string;
  description: string;
  compatibilityNotes?: string;
  installationInstructions?: string;
  priceLabel?: string;
  isPublished: boolean;
};

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> };

export function validateResourceInput(value: unknown): ValidationResult<ResourceInput> {
  if (!isRecord(value)) {
    return { success: false, errors: { form: "Invalid resource payload." } };
  }

  const errors: Record<string, string> = {};
  const publishing = value.isPublished === true;
  const title = textField(
    value.title,
    "Title",
    publishing ? 2 : 1,
    120,
    errors,
    "title",
  );
  const slug = textField(value.slug, "Slug", 2, 120, errors, "slug");
  const shortDescription = textField(
    value.shortDescription,
    "Short description",
    publishing ? 10 : 0,
    240,
    errors,
    "shortDescription",
  );
  const description = optionalText(value.description, 20_000);
  const categoryId = textField(
    value.categoryId,
    "Category",
    1,
    100,
    errors,
    "categoryId",
  );
  const authorId = textField(
    value.authorId,
    "Author",
    1,
    100,
    errors,
    "authorId",
  );
  const gameSystemId = textField(
    value.gameSystemId,
    "Game system",
    1,
    100,
    errors,
    "gameSystemId",
  );
  const currentVersion = textField(
    value.currentVersion,
    "Current version",
    1,
    40,
    errors,
    "currentVersion",
  );

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.slug = "Use lowercase letters, numbers, and single hyphens.";
  }

  const resourceType = enumField(
    value.resourceType,
    RESOURCE_TYPES,
    errors,
    "resourceType",
  );
  const compatibilityStatus = enumField(
    value.compatibilityStatus,
    COMPATIBILITY_STATUSES,
    errors,
    "compatibilityStatus",
  );
  const pricing = enumField(value.pricing, PRICING_TYPES, errors, "pricing");

  const suppliedManifestUrl = optionalUrl(value.manifestUrl, errors, "manifestUrl");
  const projectUrl = optionalUrl(value.projectUrl, errors, "projectUrl");
  const parsedDependencies = dependencyArray(value.dependencies, errors);
  const defaultLocale =
    value.defaultLocale === "es" ? ("es" as const) : ("en" as const);
  const accessMode =
    value.accessMode === "patreon"
      ? ("patreon" as const)
      : ("public" as const);
  const patreonTierIds = stringArray(value.patreonTierIds, 30, 120);
  const translations = translationInput(
    value.translations,
    {
      title,
      shortDescription,
      description,
      compatibilityNotes: optionalText(value.compatibilityNotes, 2_000),
      installationInstructions: optionalText(
        value.installationInstructions,
        8_000,
      ),
      priceLabel: optionalText(value.priceLabel, 80),
      isPublished: value.isPublished === true,
    },
    errors,
  );

  if (
    value.isPublished === true &&
    accessMode === "patreon" &&
    !patreonTierIds.length
  ) {
    errors.patreonTierIds =
      "Choose at least one Patreon tier before publishing.";
  }

  if (
    Object.keys(errors).length ||
    !resourceType ||
    !compatibilityStatus ||
    !pricing
  ) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      title,
      slug,
      shortDescription,
      description,
      resourceType,
      categoryId,
      authorId,
      gameSystemId,
      className: optionalText(value.className, 120) || undefined,
      subclassName: optionalText(value.subclassName, 120) || undefined,
      currentVersion,
      foundryMinimum: versionText(value.foundryMinimum),
      foundryVerified: versionText(value.foundryVerified),
      foundryMaximum: versionText(value.foundryMaximum),
      compatibilityStatus,
      compatibilityNotes:
        optionalText(value.compatibilityNotes, 2_000) || undefined,
      pricing,
      priceLabel: optionalText(value.priceLabel, 80) || undefined,
      manifestUrl:
        resourceType === "module" ? foundryManifestUrl(slug) : suppliedManifestUrl,
      projectUrl,
      licenseName: optionalText(value.licenseName, 160) || undefined,
      installationInstructions:
        optionalText(value.installationInstructions, 8_000) || undefined,
      tagIds: stringArray(value.tagIds, 40, 100),
      dependencies: parsedDependencies,
      changelogSummary:
        optionalText(value.changelogSummary, 240) || undefined,
      changelogDetails:
        optionalText(value.changelogDetails, 4_000) || undefined,
      defaultLocale,
      accessMode,
      patreonTierIds,
      translations,
      isFeatured: value.isFeatured === true,
      isPublished: value.isPublished === true,
    },
  };
}

function translationInput(
  value: unknown,
  fallback: ResourceTranslationInput,
  errors: Record<string, string>,
): ResourceInput["translations"] {
  const record = isRecord(value) ? value : {};
  return {
    en: parseTranslation(record.en, fallback, "en", errors),
    es: parseTranslation(
      record.es,
      {
        title: "",
        shortDescription: "",
        description: "",
        isPublished: false,
      },
      "es",
      errors,
    ),
  };
}

function parseTranslation(
  value: unknown,
  fallback: ResourceTranslationInput,
  locale: "en" | "es",
  errors: Record<string, string>,
): ResourceTranslationInput {
  if (!isRecord(value)) return fallback;
  const title = optionalText(value.title, 120);
  const shortDescription = optionalText(value.shortDescription, 240);
  const isPublished = value.isPublished === true;
  if (isPublished && title.length < 2) {
    errors[`${locale}Title`] = "Published translations need a title.";
  }
  if (isPublished && shortDescription.length < 10) {
    errors[`${locale}ShortDescription`] =
      "Published translations need a short description.";
  }
  return {
    title,
    shortDescription,
    description: optionalText(value.description, 20_000),
    compatibilityNotes:
      optionalText(value.compatibilityNotes, 2_000) || undefined,
    installationInstructions:
      optionalText(value.installationInstructions, 8_000) || undefined,
    priceLabel: optionalText(value.priceLabel, 80) || undefined,
    isPublished,
  };
}

function versionText(value: unknown): string | undefined {
  const text = optionalText(value, 40);
  return /^[0-9]+(?:\.[0-9A-Za-z-]+)*$/.test(text) ? text : undefined;
}

function stringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => sanitizePlainText(item).slice(0, maxLength))
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
}

function dependencyArray(
  value: unknown,
  errors: Record<string, string>,
): ResourceInput["dependencies"] {
  if (!Array.isArray(value)) return [];
  const result: ResourceInput["dependencies"] = [];
  for (const [index, item] of value.slice(0, 20).entries()) {
    if (!isRecord(item)) continue;
    const name = optionalText(item.name, 160);
    if (!name) {
      errors.dependencies = `Dependency ${index + 1} needs a name.`;
      continue;
    }
    const url = optionalUrl(item.url, errors, `dependency-${index}-url`);
    result.push({
      name,
      versionRange: optionalText(item.versionRange, 80) || undefined,
      url,
      isRequired: item.isRequired !== false,
    });
  }
  return result;
}

export function sanitizePlainText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function textField(
  value: unknown,
  label: string,
  min: number,
  max: number,
  errors: Record<string, string>,
  key: string,
): string {
  const text = optionalText(value, max);
  if (text.length < min) {
    errors[key] = `${label} must be at least ${min} characters.`;
  } else if (typeof value === "string" && value.length > max) {
    errors[key] = `${label} must be ${max} characters or fewer.`;
  }
  return text;
}

function optionalText(value: unknown, max: number): string {
  return typeof value === "string"
    ? sanitizePlainText(value).slice(0, max)
    : "";
}

function optionalUrl(
  value: unknown,
  errors: Record<string, string>,
  key: string,
): string | undefined {
  const text = optionalText(value, 2_000);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    errors[key] = "Enter a valid HTTP or HTTPS URL.";
    return undefined;
  }
}

function enumField<T extends string>(
  value: unknown,
  allowed: readonly T[],
  errors: Record<string, string>,
  key: string,
): T | undefined {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    errors[key] = "Choose a valid option.";
    return undefined;
  }
  return value as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
