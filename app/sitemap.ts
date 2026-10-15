import type { MetadataRoute } from "next";
import { CATEGORY_LINKS } from "../lib/config/site";
import { sitemapEntries } from "../lib/repositories/sitemap-repository";
import { canonicalUrl, publicPages } from "../lib/seo";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { resources, guides } = await sitemapEntries();
  return [
    ...publicPages.map((path) => ({ url: canonicalUrl(path) })),
    ...CATEGORY_LINKS.map((category) => ({
      url: canonicalUrl(`/categories/${category.slug}`),
    })),
    ...resources.flatMap((resource) =>
      ["", ...(resource.locales.includes("es") ? ["?lang=es"] : [])].map(
        (query) => ({
          url: canonicalUrl(
            `/resources/${encodeURIComponent(resource.slug)}${query}`,
          ),
          lastModified: new Date(resource.updatedAt),
        }),
      ),
    ),
    ...guides
      .filter((guide) => guide.slug && guide.publishedAt)
      .flatMap((guide) =>
        [
          "",
          ...(guide.content?.translations.es.title &&
          guide.content?.translations.es.body
            ? ["?lang=es"]
            : []),
        ].map((query) => ({
          url: canonicalUrl(`/wiki/${encodeURIComponent(guide.slug!)}${query}`),
          lastModified: new Date(guide.publishedAt!),
        })),
      ),
  ];
}
