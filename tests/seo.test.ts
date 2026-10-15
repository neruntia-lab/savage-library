import assert from "node:assert/strict";
import test from "node:test";
import { canonicalUrl, jsonLd, pageMetadata, publicPages } from "../lib/seo";
import { renderResourceMarkdown } from "../lib/services/resource-markdown";

test("SEO URLs always use the preferred HTTPS origin", () => {
  assert.equal(canonicalUrl("/wiki"), "https://savage-library.vercel.app/wiki");
  const metadata = pageMetadata(
    "Guide",
    "Module instructions",
    "/wiki/example",
  );
  assert.equal(metadata.alternates?.canonical, canonicalUrl("/wiki/example"));
  assert.equal(metadata.openGraph?.url, canonicalUrl("/wiki/example"));
  assert.equal(metadata.description, "Module instructions");
  assert.ok(!publicPages.includes("/account" as (typeof publicPages)[number]));
});
test("JSON-LD cannot terminate a script element", () => {
  const value = { name: "</script><script>alert(1)</script>" };
  assert.ok(!jsonLd(value).includes("<"));
  assert.deepEqual(JSON.parse(jsonLd(value)), value);
});
test("Markdown preserves one page-level heading and clamps heading jumps", () => {
  const html = renderResourceMarkdown(
    "# Title\n\n#### Detail\n\n![Scene](https://example.com/scene.webp)",
  );
  assert.doesNotMatch(html, /<h1>/);
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<h3>Detail<\/h3>/);
  assert.match(html, /alt="Scene"/);
});
