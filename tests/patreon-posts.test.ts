import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPatreonImport,
  postSlug,
  sanitizeAndExtractPaidLinks,
} from "../lib/services/patreon-posts";

test("Patreon post sanitizer extracts paid HTTPS links without exposing destinations", () => {
  const result = sanitizeAndExtractPaidLinks(
    "post-12345678",
    '<p>Hello<script>alert(1)</script> <a href="https://files.example/module.zip">[PAID] Module ZIP</a></p>',
  );
  assert.equal(result.links.length, 1);
  assert.equal(result.links[0].label, "Module ZIP");
  assert.equal(result.links[0].destination, "https://files.example/module.zip");
  assert.doesNotMatch(result.html, /files\.example/);
  assert.doesNotMatch(result.html, /script|alert/);
  assert.match(result.html, new RegExp(`/api/posts/links/${result.links[0].id}`));
});

test("structured Patreon fields produce a high-confidence module candidate", () => {
  const result = extractPatreonImport(
    "post-module",
    "Fallback title",
    `<p>Type: Module
Resource Key: savage-sounds
Title: Savage Sounds
Version: v2.3.0
Manifest: https://cdn.example.com/module.json
Tags: audio, automation
Description: A Foundry sound toolbox.</p>
<p><a href="https://cdn.example.com/savage-sounds.zip">[PAID] Module ZIP</a></p>`,
  );
  assert.equal(result.payload.resourceType, "module");
  assert.equal(result.payload.resourceKey, "savage-sounds");
  assert.equal(result.payload.title, "Savage Sounds");
  assert.equal(result.payload.version, "2.3.0");
  assert.equal(result.payload.manifestUrl, "https://cdn.example.com/module.json");
  assert.deepEqual(result.payload.tags.slice(0, 2), ["audio", "automation"]);
  assert.equal(result.links[0].role, "module");
  assert.ok(result.confidence >= 90);
});

test("free-form links infer PDF and macro candidates", () => {
  const pdf = extractPatreonImport(
    "post-pdf",
    "Printable encounter guide",
    '<p>Download the new guide.</p><a href="https://cdn.example.com/guide.pdf">Guide</a>',
  );
  assert.equal(pdf.payload.resourceType, "pdf");

  const macro = extractPatreonImport(
    "post-macro",
    "Critical hit macro v1.4",
    '<p>A new Foundry macro.</p><a href="https://cdn.example.com/critical.js">[PAID] Macro</a>',
  );
  assert.equal(macro.payload.resourceType, "macro");
  assert.equal(macro.payload.version, "1.4");
  assert.equal(macro.links[0].role, "macro");
});

test("unrecognized Patreon prose remains an unclassified review candidate", () => {
  const result = extractPatreonImport(
    "post-announcement",
    "Thank you",
    "<p>Thanks for supporting this month.</p>",
  );
  assert.equal(result.payload.resourceType, undefined);
  assert.ok(result.warnings.includes("Choose a content type."));
});

test("ordinary links remain public and unsafe paid schemes are removed", () => {
  const result = sanitizeAndExtractPaidLinks(
    "post-2",
    '<a href="https://example.com">Reference</a><a href="javascript:alert(1)">[PAID] Bad</a>',
  );
  assert.match(result.html, /https:\/\/example\.com/);
  assert.equal(result.links.length, 0);
  assert.doesNotMatch(result.html, /javascript/);
});

test("post slugs are stable and include a Patreon id suffix", () => {
  assert.equal(
    postSlug("The Archmage's Update!", "abcdef12345678"),
    "the-archmage-s-update-12345678",
  );
});
