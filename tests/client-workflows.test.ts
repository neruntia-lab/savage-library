import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchApi, requestJson } from "../lib/client/request";
import {
  normalizedMimeType,
  uploadResourceFile,
  type UploadState,
} from "../lib/client/resource-upload";
import { isLocalPreview } from "../lib/config/local-preview";
import { getDb, isDatabaseConfigured } from "../db";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("network failures resolve to a useful error so editors can reset their busy state", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  const result = await requestJson("/api/resources", { method: "POST" });
  assert.equal(result.ok, false);
  assert.match(result.body.error ?? "", /changes are still here/);
});

test("authentication and validation errors keep their server status and field messages", async () => {
  globalThis.fetch = async () =>
    Response.json({ errors: { title: "Enter a title." } }, { status: 400 });
  const result = await requestJson("/api/resources");
  assert.equal(result.ok, false);
  assert.equal(result.body.errors?.title, "Enter a title.");
  globalThis.fetch = async () =>
    Response.json({ error: "Sign in again." }, { status: 401 });
  assert.equal((await fetchApi("/api/resources")).status, 401);
});

test("HTML error pages never become successful saves", async () => {
  globalThis.fetch = async () =>
    new Response("<!DOCTYPE html><h1>Bad gateway</h1>");
  const result = await requestJson("/api/resources");
  assert.equal(result.ok, false);
  assert.match(result.body.error ?? "", /unreadable response/);
});

test("successful no-content deletion responses retain success", async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(
    (await fetchApi("/api/taxonomy/example", { method: "DELETE" })).status,
    204,
  );
  assert.deepEqual(
    await requestJson("/api/taxonomy/example", { method: "DELETE" }),
    { ok: true, body: {} },
  );
});

test("extension-based MIME inference supports empty browser types for PDF and artwork", () => {
  assert.equal(
    normalizedMimeType({ name: "Guide.PDF", type: "" }),
    "application/pdf",
  );
  assert.equal(
    normalizedMimeType({ name: "icon.webp", type: "" }),
    "image/webp",
  );
  assert.equal(
    normalizedMimeType({ name: "macro.js", type: "" }),
    "text/javascript",
  );
});

test("artwork remains unsaved unless finalization confirms the owning resource and slot", async () => {
  const states: UploadState[] = [];
  const file = new File(["image"], "cover.png", { type: "image/png" });
  const uploader: Parameters<typeof uploadResourceFile>[1] = async (
    pathname,
    body,
    options,
  ) => {
    assert.equal(options.access, "public");
    assert.match(pathname, /^resource-artwork\/resource-1\/cover\//);
    options.onUploadProgress?.({ loaded: 5, total: 5, percentage: 100 });
    return {
      url: "https://test.public.blob.vercel-storage.com/cover.png",
      downloadUrl: "https://test.public.blob.vercel-storage.com/cover.png",
      pathname,
      contentType: "image/png",
      contentDisposition: "inline",
      etag: "test-etag",
    };
  };
  const input = {
    resourceId: "resource-1",
    resourceVersionId: "version-1",
    kind: "cover" as const,
    locale: "en" as const,
    file,
    onState: (state: UploadState) => states.push(state),
  };
  globalThis.fetch = async () =>
    Response.json({
      persisted: true,
      resourceId: "another-resource",
      coverUrl: "https://example.com/cover",
    });
  await assert.rejects(uploadResourceFile(input, uploader), /did not confirm/);
  globalThis.fetch = async () =>
    Response.json({
      persisted: true,
      resourceId: "resource-1",
      coverUrl: "https://example.com/cover",
      thumbnailUrl: null,
      iconUrl: null,
    });
  assert.equal(
    (await uploadResourceFile(input, uploader)).artwork?.coverUrl,
    "https://example.com/cover",
  );
  assert.deepEqual(
    states.map((state) => state.phase),
    ["uploading", "saving", "uploading", "saving"],
  );
});

test("direct upload failures do not finalize or report success", async () => {
  globalThis.fetch = async () => {
    throw new Error("Finalization must not run");
  };
  await assert.rejects(
    uploadResourceFile(
      {
        resourceId: "resource-1",
        resourceVersionId: "version-1",
        kind: "pdf",
        locale: "en",
        file: new File(["pdf"], "guide.pdf"),
        onState: () => {},
      },
      async () => {
        throw new Error("Storage unavailable");
      },
    ),
    /Storage unavailable/,
  );
});

test("local preview cannot access a configured database or be enabled on Vercel", () => {
  const previous = {
    flag: process.env.SAVAGE_LIBRARY_LOCAL_PREVIEW,
    vercel: process.env.VERCEL,
    database: process.env.DATABASE_URL,
  };
  try {
    process.env.SAVAGE_LIBRARY_LOCAL_PREVIEW = "1";
    delete process.env.VERCEL;
    process.env.DATABASE_URL = "postgres://production.example/database";
    assert.equal(isLocalPreview(), true);
    assert.equal(isDatabaseConfigured(), false);
    assert.throws(getDb, /read-only/);
    process.env.VERCEL = "1";
    assert.equal(isLocalPreview(), false);
  } finally {
    for (const [key, value] of Object.entries({
      SAVAGE_LIBRARY_LOCAL_PREVIEW: previous.flag,
      VERCEL: previous.vercel,
      DATABASE_URL: previous.database,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
