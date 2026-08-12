import type { ResourceInput } from "../../lib/validation/resource";

export type AdminResource = {
  id: string;
  slug: string;
  title: string;
  resourceType: string;
  currentVersion: string;
  isPublished: boolean;
  isFeatured: boolean;
  downloadCount: number;
  updatedAt: string;
  resourceVersionId: string;
  accessMode?: "public" | "patreon";
  defaultLocale?: "en" | "es";
  thumbnailUrl?: string | null;
  iconUrl?: string | null;
  revision?: number;
  pendingReleaseCount: number;
};

export type EditingResource = ResourceInput & {
  id: string;
  resourceVersionId: string;
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  iconUrl?: string | null;
  files: Array<{
    id: string;
    kind: string;
    locale: "en" | "es";
    originalName: string;
    sizeBytes: number;
  }>;
  releases: Array<{
    id: string;
    version: string;
    isCurrent: boolean;
    releasedAt: string;
  }>;
};

export const EMPTY_RESOURCE: ResourceInput = {
  title: "",
  slug: "",
  shortDescription: "",
  description: "",
  resourceType: "module",
  categoryId: "",
  authorId: "",
  gameSystemId: "",
  currentVersion: "1.0.0",
  compatibilityStatus: "untested",
  pricing: "free",
  tagIds: [],
  dependencies: [],
  defaultLocale: "en",
  accessMode: "public",
  patreonTierIds: [],
  translations: {
    en: {
      title: "",
      shortDescription: "",
      description: "",
      isPublished: false,
    },
    es: {
      title: "",
      shortDescription: "",
      description: "",
      isPublished: false,
    },
  },
  isFeatured: false,
  isPublished: false,
};
