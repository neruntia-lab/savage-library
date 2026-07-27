import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { siteSettings } from "../../db/schema";
import {
  DEFAULT_HERO_IMAGE,
  type SiteAppearance,
} from "../domain/site-appearance";

const GLOBAL_SETTINGS_ID = "global";

export function defaultSiteAppearance(): SiteAppearance {
  return {
    heroImageUrl: DEFAULT_HERO_IMAGE,
    heroImagePathname: null,
    originalName: null,
    mimeType: null,
    sizeBytes: null,
    updatedAt: null,
    isDefault: true,
  };
}

export async function getSiteAppearance(): Promise<SiteAppearance> {
  try {
    return await getSiteAppearanceFromDatabase();
  } catch {
    return defaultSiteAppearance();
  }
}

export async function getSiteAppearanceFromDatabase(): Promise<SiteAppearance> {
  const rows = await getDb()
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, GLOBAL_SETTINGS_ID))
    .limit(1);
  const row = rows[0];
  if (!row?.heroImageUrl) return defaultSiteAppearance();
  return {
    heroImageUrl: row.heroImageUrl,
    heroImagePathname: row.heroImagePathname,
    originalName: row.heroImageOriginalName,
    mimeType: row.heroImageMimeType,
    sizeBytes: row.heroImageSizeBytes,
    updatedAt: row.updatedAt,
    isDefault: false,
  };
}

export async function setHeroImage(input: {
  url: string;
  pathname: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  updatedBy: string;
}): Promise<SiteAppearance> {
  const now = new Date().toISOString();
  const rows = await getDb()
    .insert(siteSettings)
    .values({
      id: GLOBAL_SETTINGS_ID,
      heroImageUrl: input.url,
      heroImagePathname: input.pathname,
      heroImageOriginalName: input.originalName,
      heroImageMimeType: input.mimeType,
      heroImageSizeBytes: input.sizeBytes,
      updatedBy: input.updatedBy,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: {
        heroImageUrl: input.url,
        heroImagePathname: input.pathname,
        heroImageOriginalName: input.originalName,
        heroImageMimeType: input.mimeType,
        heroImageSizeBytes: input.sizeBytes,
        updatedBy: input.updatedBy,
        updatedAt: now,
      },
    })
    .returning();
  const row = rows[0];
  return {
    heroImageUrl: row.heroImageUrl!,
    heroImagePathname: row.heroImagePathname,
    originalName: row.heroImageOriginalName,
    mimeType: row.heroImageMimeType,
    sizeBytes: row.heroImageSizeBytes,
    updatedAt: row.updatedAt,
    isDefault: false,
  };
}

export async function restoreDefaultHero(): Promise<string | null> {
  const previous = await getDb()
    .delete(siteSettings)
    .where(eq(siteSettings.id, GLOBAL_SETTINGS_ID))
    .returning({ pathname: siteSettings.heroImagePathname });
  return previous[0]?.pathname ?? null;
}
