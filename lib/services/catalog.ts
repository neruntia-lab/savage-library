import { SITE_CONFIG } from "../config/site";
import type {
  CatalogFilters,
  CatalogResult,
  CompatibilityStatus,
  PricingType,
  ResourceDetails,
  ResourceSort,
  ResourceSummary,
  ResourceType,
} from "../domain/resource";
import {
  COMPATIBILITY_STATUSES,
  PRICING_TYPES,
  RESOURCE_TYPES,
  SORT_OPTIONS,
} from "../domain/resource";

type SearchParamValue = string | string[] | undefined;
type SearchParamRecord = Record<string, SearchParamValue>;

export function parseCatalogFilters(
  searchParams: SearchParamRecord,
  overrides: Partial<CatalogFilters> = {},
): CatalogFilters {
  const pageSize = clampInteger(
    first(searchParams.pageSize),
    1,
    SITE_CONFIG.maxPageSize,
    SITE_CONFIG.defaultPageSize,
  );

  return {
    query: cleanFilter(first(searchParams.q)),
    resourceType: enumValue(
      first(searchParams.type),
      RESOURCE_TYPES,
    ) as ResourceType | undefined,
    system: cleanFilter(first(searchParams.system)),
    foundryVersion: cleanFilter(first(searchParams.foundry)),
    moduleVersion: cleanFilter(first(searchParams.version)),
    classOrSubclass: cleanFilter(first(searchParams.class)),
    pricing: enumValue(
      first(searchParams.pricing),
      PRICING_TYPES,
    ) as PricingType | undefined,
    tag: cleanFilter(first(searchParams.tag)),
    author: cleanFilter(first(searchParams.author)),
    compatibility: enumValue(
      first(searchParams.compatibility),
      COMPATIBILITY_STATUSES,
    ) as CompatibilityStatus | undefined,
    category: cleanFilter(first(searchParams.category)),
    sort:
      (enumValue(first(searchParams.sort), SORT_OPTIONS) as
        | ResourceSort
        | undefined) ?? "recently-added",
    page: clampInteger(first(searchParams.page), 1, 10_000, 1),
    pageSize,
    ...overrides,
  };
}

export function filterCatalog(
  resources: ResourceDetails[],
  filters: CatalogFilters,
): CatalogResult {
  const query = normalize(filters.query);
  const classQuery = normalize(filters.classOrSubclass);

  const filtered = resources.filter((resource) => {
    const searchable = normalize(
      [
        resource.title,
        resource.shortDescription,
        resource.description,
        resource.author.name,
        resource.category.name,
        resource.gameSystem.name,
        resource.tags.map((tag) => tag.name).join(" "),
      ].join(" "),
    );

    return (
      (!query || searchable.includes(query)) &&
      (!filters.resourceType ||
        resource.resourceType === filters.resourceType) &&
      (!filters.system || resource.gameSystem.slug === filters.system) &&
      (!filters.foundryVersion ||
        versionInRange(
          filters.foundryVersion,
          resource.foundryMinimum,
          resource.foundryMaximum,
        )) &&
      (!filters.moduleVersion ||
        resource.currentVersion === filters.moduleVersion) &&
      (!classQuery ||
        normalize(
          `${resource.className ?? ""} ${resource.subclassName ?? ""}`,
        ).includes(classQuery)) &&
      (!filters.pricing || resource.pricing === filters.pricing) &&
      (!filters.tag ||
        resource.tags.some((tag) => tag.slug === filters.tag)) &&
      (!filters.author || resource.author.slug === filters.author) &&
      (!filters.compatibility ||
        resource.compatibilityStatus === filters.compatibility) &&
      (!filters.category || resource.category.slug === filters.category)
    );
  });

  const sorted = [...filtered].sort(sorter(filters.sort));
  const pageCount = Math.max(1, Math.ceil(sorted.length / filters.pageSize));
  const page = Math.min(filters.page, pageCount);
  const start = (page - 1) * filters.pageSize;

  return {
    items: sorted.slice(start, start + filters.pageSize),
    total: sorted.length,
    page,
    pageSize: filters.pageSize,
    pageCount,
  };
}

export function toSummary(resource: ResourceDetails): ResourceSummary {
  return {
    id: resource.id,
    slug: resource.slug,
    title: resource.title,
    shortDescription: resource.shortDescription,
    resourceType: resource.resourceType,
    category: resource.category,
    author: resource.author,
    gameSystem: resource.gameSystem,
    className: resource.className,
    subclassName: resource.subclassName,
    currentVersion: resource.currentVersion,
    foundryMinimum: resource.foundryMinimum,
    foundryVerified: resource.foundryVerified,
    foundryMaximum: resource.foundryMaximum,
    compatibilityStatus: resource.compatibilityStatus,
    pricing: resource.pricing,
    priceLabel: resource.priceLabel,
    tags: resource.tags,
    thumbnailUrl: resource.thumbnailUrl,
    isFeatured: resource.isFeatured,
    downloadCount: resource.downloadCount,
    popularityScore: resource.popularityScore,
    publishedAt: resource.publishedAt,
    updatedAt: resource.updatedAt,
  };
}

function sorter(
  sort: ResourceSort,
): (left: ResourceDetails, right: ResourceDetails) => number {
  switch (sort) {
    case "recently-updated":
      return (left, right) => right.updatedAt.localeCompare(left.updatedAt);
    case "alphabetical":
      return (left, right) => left.title.localeCompare(right.title);
    case "most-downloaded":
      return (left, right) => right.downloadCount - left.downloadCount;
    case "most-popular":
      return (left, right) => right.popularityScore - left.popularityScore;
    case "recently-added":
    default:
      return (left, right) =>
        right.publishedAt.localeCompare(left.publishedAt);
  }
}

function versionInRange(
  requested: string,
  minimum?: string | null,
  maximum?: string | null,
): boolean {
  const value = Number.parseInt(requested, 10);
  const min = minimum ? Number.parseInt(minimum, 10) : null;
  const max = maximum ? Number.parseInt(maximum, 10) : null;
  if (!Number.isFinite(value)) return false;
  return (min === null || value >= min) && (max === null || value <= max);
}

function first(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function cleanFilter(value?: string): string | undefined {
  const cleaned = value?.trim().slice(0, 120);
  return cleaned || undefined;
}

function enumValue<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}

function clampInteger(
  value: string | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, parsed))
    : fallback;
}

function normalize(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
