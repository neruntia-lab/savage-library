import assert from "node:assert/strict";
import test from "node:test";
import {
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
