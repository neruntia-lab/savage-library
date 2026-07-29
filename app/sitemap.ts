import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { CATEGORY_LINKS } from "../lib/config/site";
import { listCatalog } from "../lib/repositories/resource-repository";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await metadataOrigin();
  const catalog = await listCatalog({
    sort: "recently-updated",
    page: 1,
    pageSize: 48,
  });

  return [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    {
      url: `${origin}/library`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...CATEGORY_LINKS.map((category) => ({
      url: `${origin}/categories/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
    ...catalog.items.map((resource) => ({
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
