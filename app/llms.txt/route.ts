import { SITE_CONFIG } from "../../lib/config/site";
import { canonicalUrl } from "../../lib/seo";
import { sitemapEntries } from "../../lib/repositories/sitemap-repository";
export const dynamic = "force-dynamic";
export async function GET() {
  const { resources, guides } = await sitemapEntries();
  const lines = [
    "# Savage Library",
    "",
    SITE_CONFIG.description,
    "",
    "Public descriptions and guides are available to browse. Some downloads require an eligible membership.",
    "",
    "## Public pages",
    `- [Library](${canonicalUrl("/")})`,
    `- [Wiki](${canonicalUrl("/wiki")})`,
    `- [Terms and Privacy](${canonicalUrl("/legal")})`,
    "",
    "## Resources",
    ...resources.map(
      (item) =>
        `- [${item.slug}](${canonicalUrl(`/resources/${encodeURIComponent(item.slug)}`)})`,
    ),
    "",
    "## Guides",
    ...guides
      .filter((item) => item.slug)
      .map(
        (item) =>
          `- [${item.slug}](${canonicalUrl(`/wiki/${encodeURIComponent(item.slug!)}`)})`,
      ),
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
