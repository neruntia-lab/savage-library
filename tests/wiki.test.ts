import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyWikiContent } from "../lib/domain/wiki";
import {
  validateWikiInput,
  WikiError,
  wikiLanguage,
  browseWiki,
  wikiPublicationFields,
} from "../lib/services/wiki";
import { renderWikiMarkdown } from "../lib/services/wiki-markdown";
import { WIKI_EXAMPLES, WIKI_ADMIN_EXAMPLES } from "../lib/data/wiki-examples";
import { publicWikiArtworkUrl } from "../lib/services/resource-artwork";
import { PUBLIC_NAVIGATION } from "../lib/config/site";

function input() {
  const content = emptyWikiContent();
  content.translations.en = {
    title: "A guide",
    summary: "Summary",
    body: "## Install\n\nModule instructions.",
  };
  return { slug: "a-guide", moduleId: null, content };
}
test("navigation contains only the three requested destinations in order", () => {
  assert.deepEqual(
    PUBLIC_NAVIGATION.map((n) => [n.label, n.href]),
    [
      ["Library", "/"],
      ["Wiki", "/wiki"],
      ["Terms & Privacy", "/legal"],
    ],
  );
});
test("preview starter drafts stay out of the public list", () => {
  const starters = WIKI_ADMIN_EXAMPLES.filter(
    (guide) => guide.starterResourceId,
  );
  assert.ok(starters.length);
  for (const guide of starters) {
    assert.equal(guide.isPublished, false);
    assert.equal(guide.draft.translations[guide.draft.defaultLocale].body, "");
    assert.ok(!WIKI_EXAMPLES.some((published) => published.id === guide.id));
  }
});
test("Wiki card artwork accepts public images but not private destinations", () => {
  assert.equal(
    publicWikiArtworkUrl(
      "https://store.public.blob.vercel-storage.com/image.png",
    ),
    "https://store.public.blob.vercel-storage.com/image.png",
  );
  assert.equal(publicWikiArtworkUrl("/logo.png"), "/logo.png");
  for (const value of [
    null,
    "private-key",
    "/api/downloads/secret",
    "https://store.private.blob.vercel-storage.com/module.zip",
    "https://store.public.blob.vercel-storage.com.evil.org/x",
    "http://store.public.blob.vercel-storage.com/x",
    "javascript:alert(1)",
  ])
    assert.equal(publicWikiArtworkUrl(value), null);
});
test("Wiki validates drafts and requires a complete default language to publish", () => {
  const guide = input();
  assert.doesNotThrow(() => validateWikiInput(guide, true));
  guide.content.translations.en.body = "";
  assert.doesNotThrow(() => validateWikiInput(guide));
  assert.throws(
    () => validateWikiInput(guide, true),
    (error) => error instanceof WikiError && Boolean(error.errors["en.body"]),
  );
  for (const malformed of [
    null,
    [],
    {},
    { ...input(), slug: "Bad/Slug" },
    { ...input(), moduleId: 12 },
    { ...input(), content: { defaultLocale: "fr" } },
  ])
    assert.throws(() => validateWikiInput(malformed), WikiError);
  const long = input();
  long.content.translations.en.summary = "x".repeat(241);
  assert.throws(() => validateWikiInput(long), WikiError);
});
test("publication preserves the working draft and strips unfinished translations", () => {
  const guide = input();
  guide.content.translations.es = {
    title: "",
    summary: "Private unfinished note",
    body: "Unfinished draft",
  };
  const data = validateWikiInput(guide, true);
  assert.deepEqual(wikiPublicationFields("draft", data, "now"), {});
  const published = wikiPublicationFields("publish", data, "now");
  assert.equal(published.publishedSlug, guide.slug);
  assert.equal(published.publishedAt, "now");
  assert.equal(published.publishedContent?.translations.es.body, "");
  assert.equal(data.content.translations.es.body, "Unfinished draft");
  assert.deepEqual(wikiPublicationFields("unpublish", data, "now"), {
    publishedContent: null,
    publishedSlug: null,
    publishedModuleId: null,
    publishedAt: null,
  });
});
test("Wiki language selection visibly falls back to a complete default translation", () => {
  assert.equal(wikiLanguage(input().content, "es").fallback, true);
  assert.deepEqual(wikiLanguage(input().content).available, ["en"]);
  assert.equal(wikiLanguage(WIKI_EXAMPLES[0].content, "es").locale, "es");
});
test("Wiki search, association filters, recency ordering, and bounded pagination compose", () => {
  assert.equal(browseWiki(WIKI_EXAMPLES, "Instala", "", 1).total, 1);
  assert.equal(
    browseWiki(WIKI_EXAMPLES, "", "general", 1).items[0].module,
    null,
  );
  assert.equal(
    browseWiki(WIKI_EXAMPLES, "", WIKI_EXAMPLES[0].module!.id, 1).total,
    1,
  );
  const many = Array.from({ length: 41 }, (_, i) => ({
    ...WIKI_EXAMPLES[0],
    slug: `guide-${i}`,
    id: `guide-${i}`,
  }));
  const result = browseWiki(many, "", "", 99);
  assert.equal(result.page, 3);
  assert.equal(result.items.length, 1);
  assert.equal(browseWiki(many, "", "", NaN).page, 1);
});
test("Wiki Markdown strips unsafe markup and creates collision-free heading anchors", () => {
  const document = renderWikiMarkdown(
    "# Intro\n\n## Intro\n\n<script>alert(1)</script><img src='javascript:alert(1)' onerror='oops'>\n\n[bad](javascript:alert(1))",
  );
  assert.doesNotMatch(document.html, /<script|onerror|javascript:/);
  assert.deepEqual(
    document.headings.map((h) => h.id),
    ["wiki-section-1", "wiki-section-2"],
  );
  assert.match(document.html, /<h2 id="wiki-section-1">/);
});
