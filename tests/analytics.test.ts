import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsEnabled,
  isPublicAnalyticsPath,
  sanitizeAnalyticsEvent,
} from "../lib/analytics";

const origin = "https://savage-library.vercel.app";
test("analytics only enables for Vercel Production", () => {
  assert.equal(analyticsEnabled("production"), true);
  for (const environment of [undefined, "", "preview", "development", "test"])
    assert.equal(analyticsEnabled(environment), false);
});
test("public page views redact query strings and fragments without mutating input", () => {
  for (const path of [
    "/",
    "/wiki",
    "/legal",
    "/privacy",
    "/terms",
    "/library",
    "/categories/foundry-modules",
    "/resources/savage-craft",
    "/wiki/module-guide",
  ]) {
    assert.equal(isPublicAnalyticsPath(path), true);
    const event = {
      type: "pageview" as const,
      url: `${origin}${path}?q=private-email&token=secret#personal`,
    };
    assert.deepEqual(sanitizeAnalyticsEvent(event), {
      type: "pageview",
      url: `${origin}${path}`,
    });
    assert.ok(event.url.includes("token=secret"));
  }
});
test("private, unknown, preview, malformed, and custom events cannot be sent", () => {
  for (const path of [
    "/admin",
    "/admin/resources/secret",
    "/account",
    "/logout",
    "/api/auth/callback/patreon",
    "/api/downloads/secret",
    "/api/foundry/shared/secret/module.json",
    "/dev/preview",
    "/resources/savage-craft?preview=secret",
    "/resources/savage-craft?preview=",
    "/news",
    "/wiki/guide/edit",
  ]) {
    assert.equal(
      sanitizeAnalyticsEvent({ type: "pageview", url: origin + path }),
      null,
      path,
    );
  }
  for (const url of [
    "not a url",
    "http://localhost:3000/",
    "https://preview.vercel.app/",
    "https://name:password@savage-library.vercel.app/",
  ])
    assert.equal(sanitizeAnalyticsEvent({ type: "pageview", url }), null);
  assert.equal(
    sanitizeAnalyticsEvent({ type: "event", url: origin + "/" }),
    null,
  );
});
