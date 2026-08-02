import assert from "node:assert/strict";
import test from "node:test";
import { renderResourceMarkdown } from "../lib/services/resource-markdown";

test("resource Markdown renders formatting and secure HTTPS images", () => {
  const html = renderResourceMarkdown(
    "## Features\n\n- One\n- Two\n\n![Preview](https://example.com/preview.webp)",
  );
  assert.match(html, /<h2>Features<\/h2>/);
  assert.match(html, /<li>One<\/li>/);
  assert.match(html, /src="https:\/\/example.com\/preview.webp"/);
  assert.match(html, /loading="lazy"/);
});

test("resource Markdown strips scripts, handlers, and unsafe URLs", () => {
  const html = renderResourceMarkdown(
    '<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(2)"> [bad](javascript:alert(3))',
  );
  assert.doesNotMatch(html, /<script|onerror|(?:href|src)="javascript:/i);
  assert.doesNotMatch(html, /<img/i);
});
