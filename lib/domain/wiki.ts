export type WikiLocale = "en" | "es";
export type WikiTranslation = { title: string; summary: string; body: string };
export type WikiContent = {
  defaultLocale: WikiLocale;
  translations: Record<WikiLocale, WikiTranslation>;
};
export type WikiModule = {
  id: string;
  slug: string;
  title: string;
  cardArtworkUrl?: string;
};
export type PublicWikiGuide = {
  id: string;
  slug: string;
  content: WikiContent;
  module: WikiModule | null;
  publishedAt: string;
  sample?: boolean;
};
export type AdminWikiGuide = {
  id: string;
  slug: string;
  draft: WikiContent;
  moduleId: string | null;
  starterResourceId: string | null;
  isPublished: boolean;
  revision: number;
  updatedAt: string;
  publishedAt: string | null;
};
export const emptyWikiContent = (): WikiContent => ({
  defaultLocale: "en",
  translations: {
    en: { title: "", summary: "", body: "" },
    es: { title: "", summary: "", body: "" },
  },
});
