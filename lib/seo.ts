import type { Metadata } from "next";
import { CANONICAL_SITE_ORIGIN, SITE_CONFIG } from "./config/site";

export const publicPages = ["/", "/wiki", "/legal"] as const;
export const indexingEnabled = () => process.env.VERCEL_ENV === "production";
export function canonicalUrl(path: string): string {
  return new URL(path, CANONICAL_SITE_ORIGIN).href;
}
export function pageMetadata(
  title: string,
  description: string,
  path: string,
  image = "/og-social.jpg",
): Metadata {
  const url = canonicalUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: SITE_CONFIG.name,
      images: [{ url: canonicalUrl(image), alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [canonicalUrl(image)],
    },
  };
}
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}
