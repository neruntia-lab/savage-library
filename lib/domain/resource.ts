export const RESOURCE_TYPES = [
  "module",
  "class",
  "subclass",
  "pdf",
] as const;

export const PRICING_TYPES = ["free", "premium"] as const;

export const COMPATIBILITY_STATUSES = [
  "verified",
  "compatible",
  "untested",
  "outdated",
  "unsupported",
] as const;

export const SORT_OPTIONS = [
  "recently-added",
  "recently-updated",
  "alphabetical",
  "most-downloaded",
  "most-popular",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type PricingType = (typeof PRICING_TYPES)[number];
export type CompatibilityStatus = (typeof COMPATIBILITY_STATUSES)[number];
export type ResourceSort = (typeof SORT_OPTIONS)[number];
export type FileKind = "pdf" | "module" | "cover" | "thumbnail" | "manifest";

export type ResourceSummary = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  resourceType: ResourceType;
  category: NamedEntity;
  author: NamedEntity & { websiteUrl?: string | null };
  gameSystem: NamedEntity;
  className?: string | null;
  subclassName?: string | null;
  currentVersion: string;
  foundryMinimum?: string | null;
  foundryVerified?: string | null;
  foundryMaximum?: string | null;
  compatibilityStatus: CompatibilityStatus;
  pricing: PricingType;
  priceLabel?: string | null;
  tags: NamedEntity[];
  thumbnailUrl?: string | null;
  isFeatured: boolean;
  downloadCount: number;
  popularityScore: number;
  publishedAt: string;
  updatedAt: string;
};

export type ResourceDetails = ResourceSummary & {
  description: string;
  compatibilityNotes?: string | null;
  coverUrl?: string | null;
  installationInstructions?: string | null;
  licenseName?: string | null;
  licenseUrl?: string | null;
  manifestUrl?: string | null;
  projectUrl?: string | null;
  files: ResourceFile[];
  dependencies: Dependency[];
  changelog: ChangelogEntry[];
  relatedResources: ResourceSummary[];
};

export type NamedEntity = {
  id: string;
  name: string;
  slug: string;
};

export type ResourceFile = {
  id: string;
  kind: FileKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  isRestricted: boolean;
};

export type Dependency = {
  id: string;
  name: string;
  versionRange?: string | null;
  url?: string | null;
  isRequired: boolean;
};

export type ChangelogEntry = {
  id: string;
  version: string;
  summary: string;
  details: string;
  publishedAt: string;
};

export type CatalogFilters = {
  query?: string;
  resourceType?: ResourceType;
  system?: string;
  foundryVersion?: string;
  moduleVersion?: string;
  classOrSubclass?: string;
  pricing?: PricingType;
  tag?: string;
  author?: string;
  compatibility?: CompatibilityStatus;
  category?: string;
  sort: ResourceSort;
  page: number;
  pageSize: number;
};

export type CatalogResult = {
  items: ResourceSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type CatalogFacets = {
  authors: NamedEntity[];
  categories: NamedEntity[];
  gameSystems: NamedEntity[];
  tags: NamedEntity[];
  foundryVersions: string[];
  moduleVersions: string[];
  classes: string[];
};
