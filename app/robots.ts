import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function robots(): Promise<MetadataRoute.Robots> {
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
  const origin = `${protocol}://${safeHost}`;
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/library", "/categories/", "/resources/"],
        disallow: ["/admin", "/account", "/api/"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
