import assert from "node:assert/strict";
import { test } from "node:test";
import { patreonRead } from "../lib/services/patreon-http";
import { containsPattern, pagination } from "../lib/repositories/query-utils";
import { createImportMatcher } from "../lib/services/import-matching";

test("indexed import matching keeps precedence and rejects ambiguous destinations", () => {
  const match = createImportMatcher([
    {
      id: "a",
      slug: "first",
      title: "Módulo uno",
      manifestUrl: "https://example.com/module.json",
      projectUrl: null,
    },
    {
      id: "b",
      slug: "second",
      title: "Other",
      manifestUrl: "https://example.com/module.json",
      projectUrl: "https://example.com/project",
    },
  ]);
  assert.deepEqual(match({ resourceKey: "second", title: "Módulo uno" }), {
    resourceId: "b",
    matchedBy: "resource_key",
  });
  assert.deepEqual(match({ title: "Modulo uno" }), {
    resourceId: "a",
    matchedBy: "title",
  });
  assert.deepEqual(
    match({
      title: "Unknown",
      manifestUrl: "https://example.com/module.json#ignored",
    }),
    { resourceId: null, matchedBy: "ambiguous_manifest_url" },
  );
  assert.deepEqual(
    match({ title: "Unknown", projectUrl: "https://example.com/project/" }),
    { resourceId: "b", matchedBy: "project_url" },
  );
});

test("pagination clamps hostile inputs and search wildcards stay literal", () => {
  assert.deepEqual(pagination(10000, 99999, 24), {
    total: 10000,
    page: 417,
    pageCount: 417,
    pageSize: 24,
    offset: 9984,
  });
  assert.equal(pagination(0, NaN, 20).page, 1);
  assert.equal(pagination(5, -99, 20).page, 1);
  assert.equal(containsPattern(" 100%_\\ "), "%100\\%\\_\\\\%");
});

test("Patreon reads retry transient responses with bounded backoff, not authentication failures", async () => {
  const delays: number[] = [];
  let calls = 0;
  const transport = {
    fetch: (async (_url, options) => {
      assert.ok(options?.signal);
      assert.equal(options?.cache, "no-store");
      calls++;
      return calls < 3
        ? new Response("Unavailable", {
            status: 503,
            headers: { "retry-after": "9999" },
          })
        : Response.json({ data: [] });
    }) as typeof fetch,
    pause: async (ms: number) => {
      delays.push(ms);
    },
  };
  assert.equal(
    (
      await patreonRead(
        "https://www.patreon.com/api/oauth2/v2/test",
        "secret",
        transport,
      )
    ).status,
    200,
  );
  assert.equal(calls, 3);
  assert.deepEqual(delays, [5000, 5000]);
  calls = 0;
  await assert.rejects(
    patreonRead("https://www.patreon.com/test", "secret", {
      ...transport,
      fetch: (async () => {
        calls++;
        return new Response("private data", { status: 401 });
      }) as typeof fetch,
    }),
    /Patreon returned 401/,
  );
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(
    patreonRead("https://www.patreon.com/test", "secret", {
      ...transport,
      fetch: (async () => {
        calls++;
        throw new Error("secret token");
      }) as typeof fetch,
    }),
    /could not be reached/,
  );
  assert.equal(calls, 3);
});
