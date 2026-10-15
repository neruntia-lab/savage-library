import type { MetadataRoute } from "next";
import { canonicalUrl, indexingEnabled } from "../lib/seo";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      ...(indexingEnabled()
        ? {
            allow: "/",
            disallow: ["/admin", "/account", "/logout", "/dev/", "/api/"],
          }
        : { disallow: "/" }),
    },
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}
