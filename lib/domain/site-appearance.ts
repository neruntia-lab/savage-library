export const DEFAULT_HERO_IMAGE = "/images/hero/arcane-archive.webp";

export interface SiteAppearance {
  heroImageUrl: string;
  heroImagePathname: string | null;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  updatedAt: string | null;
  isDefault: boolean;
}
