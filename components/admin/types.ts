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
};

export type EditingResource = ResourceInput & { id: string };

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
  isFeatured: false,
  isPublished: false,
};
