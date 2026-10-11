import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { CATEGORY_LINKS } from "../lib/config/site";
import { sitemapEntries } from "../lib/repositories/sitemap-repository";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await metadataOrigin();
  const { resources, guides } = await sitemapEntries();

  return [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/wiki`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/legal`, changeFrequency: "yearly", priority: 0.3 },
    ...guides.map((guide) => ({
      url: `${origin}/wiki/${guide.slug}`,
      lastModified: new Date(guide.publishedAt!),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    {
      url: `${origin}/library`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    { url: `${origin}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/terms`, changeFrequency: "yearly", priority: 0.3 },
    ...CATEGORY_LINKS.map((category) => ({
      url: `${origin}/categories/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
    ...resources.map((resource) => ({
      url: `${origin}/resources/${resource.slug}`,
      lastModified: new Date(resource.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}

async function metadataOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const safeHost =
    host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host) ? host : "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") === "https" ||
    !safeHost.startsWith("localhost")
      ? "https"
      : "http";
  return `${protocol}://${safeHost}`;
}
