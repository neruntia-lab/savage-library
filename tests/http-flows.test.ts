import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { scryptSync } from "node:crypto";
import path from "node:path";
import { after, before, test } from "node:test";

const port = 31_000 + (process.pid % 1_000);
const origin = `http://localhost:${port}`;
const testAdminPassword = "http-flow-admin-password";
const testAdminSalt = "http-flow-admin-salt";
const testAdminHash = `scrypt$${testAdminSalt}$${scryptSync(testAdminPassword, testAdminSalt, 64).toString("hex")}`;
let server: ChildProcess;
let serverOutput = "";

before(async () => {
  const testEnvironment = { ...process.env };
  delete testEnvironment.VERCEL;
  server = spawn(
    process.execPath,
    [
      path.join(process.cwd(), "node_modules/next/dist/bin/next"),
      "start",
      "-p",
      String(port),
      "--hostname",
      "127.0.0.1",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...testEnvironment,
        SAVAGE_LIBRARY_LOCAL_PREVIEW: "1",
        AUTH_SECRET: "http-flow-test-auth-secret-not-for-production",
        ADMIN_PASSWORD_HASH: testAdminHash,
        NEXTAUTH_URL: origin,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  server.stdout?.on("data", (chunk) => {
    serverOutput = `${serverOutput}${String(chunk)}`.slice(-4_000);
  });
  server.stderr?.on("data", (chunk) => {
    serverOutput = `${serverOutput}${String(chunk)}`.slice(-4_000);
  });

  await waitForServer();
});

after(() => {
  server?.kill();
});

test("public pages load without the retired construction login", async () => {
  const home = await fetch(origin);
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /Savage Library/);
  assert.match(html, /Open navigation menu/);
  assert.match(html, /aria-controls="mobile-navigation"/);
  assert.match(html, /aria-label="Mobile navigation"/);
  assert.match(html, /Patreon access/);
  assert.doesNotMatch(html, /footer-seal/);
  assert.doesNotMatch(html, /href="\/admin"/);
  assert.doesNotMatch(html, /Site under construction/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
});

test("home-to-library discovery flow renders searchable catalog content", async () => {
  const home = await get("/");
  assert.match(home, /Savage Library/);
  assert.match(home, /Search the archive/);
  assert.match(home, /Foundry VTT Modules/);

  const library = await get(
    "/library?q=crafting&type=module&system=dnd5e&foundry=13&sort=most-downloaded",
  );
  assert.match(library, /Savage Craft/);
  assert.match(library, /matching/);
  assert.match(library, /Source type/);
  assert.match(library, /Sort by/);
  assert.doesNotMatch(library, /filter-advanced|Apply filters/);
  assert.doesNotMatch(library, /Vanguard Class/);

  const tagSearch = await get("/library?q=Automation");
  assert.match(tagSearch, /Savage Craft/);
});

test("homepage is a complete filterable catalog with one banner search", async () => {
  const home = await get("/?page=99&pageSize=1");
  assert.match(home, /Browse the library/);
  assert.match(home, /id="library"/);
  assert.match(home, /action="\/#library"/);
  assert.equal((home.match(/type="search"/g) ?? []).length, 1);
  assert.equal((home.match(/<article class="resource-card"/g) ?? []).length, 5);
  assert.doesNotMatch(
    home,
    /Featured discoveries|Explore the collection|class="category-card"|aria-label="Resource pages"/,
  );
  assert.doesNotMatch(home, /href="[^\"]*\?tag=/);
  const filtered = await get("/?q=crafting&type=module&sort=most-downloaded");
  assert.equal(
    (filtered.match(/<article class="resource-card"/g) ?? []).length,
    1,
  );
  assert.match(filtered, /Savage Craft/);
  assert.match(filtered, /type="hidden" name="q" value="crafting"/);
  assert.match(filtered, /type="hidden" name="type" value="module"/);
  assert.match(filtered, /Clear filters/);
  assert.doesNotMatch(filtered, /Vanguard Class/);
  const empty = await get("/?q=no-matching-entry");
  assert.match(empty, /No resources found/);
  const api = await fetch(`${origin}/api/resources?pageSize=1`);
  assert.equal(api.status, 200);
  assert.equal((await api.json()).items.length, 1);
});

test("public browser ignores retired filters while the API retains them", async () => {
  const retired =
    "tag=nonexistent&author=nonexistent&pricing=premium&foundry=999&version=999&class=nonexistent&compatibility=unsupported&category=nonexistent";
  for (const route of ["/", "/library"]) {
    const html = await get(`${route}?${retired}`);
    assert.equal(
      (html.match(/<article class="resource-card"/g) ?? []).length,
      5,
    );
    for (const name of [
      "tag",
      "author",
      "pricing",
      "foundry",
      "version",
      "class",
      "compatibility",
      "category",
    ]) {
      assert.doesNotMatch(html, new RegExp(`name="${name}"`));
    }
    assert.equal((html.match(/<select /g) ?? []).length, 3);
  }
  const category = await get(`/categories/foundry-modules?${retired}`);
  assert.equal(
    (category.match(/<article class="resource-card"/g) ?? []).length,
    2,
  );
  const api = await fetch(`${origin}/api/resources?tag=nonexistent`);
  assert.equal((await api.json()).total, 0);
});

test("resource detail flow exposes attribution, compatibility, and manifest actions", async () => {
  const details = await get("/resources/savage-craft");
  assert.match(details, /José Felipe/);
  assert.match(details, /Foundry support/);
  assert.match(details, /Installation instructions/);
  assert.match(details, /Copy manifest/);
  assert.match(details, /api\/foundry\/modules\/savage-craft\/module\.json/);
  assert.match(details, /All rights reserved/);
  assert.doesNotMatch(details, /<h2>Files<\/h2>/);
  assert.doesNotMatch(details, /Download module/i);
});

test("category and discovery metadata routes are available", async () => {
  const category = await get("/categories/foundry-modules");
  assert.match(category, /Foundry VTT Modules/);
  assert.match(category, /Savage Training/);

  const sitemap = await get("/sitemap.xml");
  assert.match(sitemap, /resources\/savage-craft/);
  assert.match(sitemap, /\/privacy/);
  assert.match(sitemap, /\/terms/);
  assert.doesNotMatch(sitemap, /\/news/);

  const robots = await get("/robots.txt");
  assert.match(robots, /Disallow: \/admin/);

  const removedNews = await fetch(`${origin}/news`, {});
  assert.equal(removedNews.status, 404);
});

test("publisher catalog orchestration rejects missing administrator credentials", async () => {
  const verify = await fetch(`${origin}/api/publisher/admin/verify`, {
    method: "POST",
  });
  assert.equal(verify.status, 401);
  assert.equal((await verify.json()).code, "admin_cli_token_invalid");
  const catalog = await fetch(`${origin}/api/publisher/catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module: {}, resource: {} }),
  });
  assert.equal(catalog.status, 401);
  const notes = await fetch(`${origin}/api/publisher/catalog/release-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(notes.status, 401);
});

test("content wizard APIs require administrator authentication", async () => {
  const create = await fetch(`${origin}/api/resources/wizard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Test", resourceType: "pdf" }),
  });
  assert.equal(create.status, 401);
  const resume = await fetch(`${origin}/api/resources/resource-id/wizard`);
  assert.equal(resume.status, 401);
});

test("legal disclosures are publicly available", async () => {
  const privacy = await get("/privacy");
  assert.match(privacy, /Privacy policy/);
  assert.match(privacy, /Patreon account identifiers/);
  assert.match(privacy, /library@neruntia-lab\.com/);

  const terms = await get("/terms");
  assert.match(terms, /Terms of service/);
  assert.match(terms, /Licenses and permitted use/);
  assert.match(terms, /unauthorized redistribution/);
});

test("logout confirmation and draft previews fail safely", async () => {
  const logout = await get("/logout");
  assert.match(logout, /Sign out · Savage Library/);
  assert.match(logout, /noindex, nofollow/);

  const preview = await fetch(
    `${origin}/resources/savage-craft?preview=resource-savage-craft`,
    { redirect: "manual" },
  );
  const previewHtml = await preview.text();
  assert.doesNotMatch(previewHtml, /Private draft preview/);
  assert.doesNotMatch(previewHtml, /Downloads and manifests are disabled/);
});

test("admin credentials callback handles invalid passwords without a server error", async () => {
  const csrfResponse = await fetch(`${origin}/api/auth/csrf`);
  assert.equal(csrfResponse.status, 200);
  const csrf = (await csrfResponse.json()) as { csrfToken: string };
  const cookies = csrfResponse.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .join("; ");

  const response = await fetch(`${origin}/api/auth/callback/admin-password`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      password: "definitely-not-the-admin-password",
      callbackUrl: `${origin}/admin`,
      json: "true",
    }),
  });

  assert.notEqual(response.status, 500);
  const result = (await response.json()) as { url?: string };
  assert.match(result.url ?? "", /error=CredentialsSignin/);
});

test("admin credentials callback creates an administrator session", async () => {
  const csrfResponse = await fetch(`${origin}/api/auth/csrf`);
  const csrf = (await csrfResponse.json()) as { csrfToken: string };
  const csrfCookies = csrfResponse.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0]);

  const response = await fetch(`${origin}/api/auth/callback/admin-password`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookies.join("; "),
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      password: testAdminPassword,
      callbackUrl: `${origin}/admin`,
      json: "true",
    }),
  });

  assert.equal(response.status, 200);
  const result = (await response.json()) as { url?: string };
  assert.equal(result.url, `${origin}/admin`);
  const sessionCookies = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0]);
  const sessionResponse = await fetch(`${origin}/api/auth/session`, {
    headers: { Cookie: [...csrfCookies, ...sessionCookies].join("; ") },
  });
  const session = (await sessionResponse.json()) as {
    user?: { role?: string };
  };
  assert.equal(session.user?.role, "admin");
  const headers = { Cookie: [...csrfCookies, ...sessionCookies].join("; ") };
  const taxonomy = await fetch(`${origin}/api/taxonomy`, { headers });
  assert.equal(taxonomy.status, 200);
  assert.ok((await taxonomy.json()).facets.categories.length > 0);
  const releases = await fetch(
    `${origin}/api/admin/resources/resource-savage-craft/releases`,
    { headers },
  );
  assert.equal(releases.status, 200);
  assert.deepEqual((await releases.json()).releases, []);
  const preview = await fetch(
    `${origin}/admin/resources/resource-savage-craft/preview`,
    { headers },
  );
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(
    preview.headers.get("Content-Security-Policy"),
    "frame-ancestors 'self'",
  );
  const previewPage = await fetch(
    `${origin}/resources/savage-craft?preview=resource-savage-craft`,
    { headers },
  );
  assert.equal(previewPage.status, 200);
  assert.match(await previewPage.text(), /Private draft preview/);
});

test("publisher verification requires a module-scoped bearer token", async () => {
  const response = await fetch(`${origin}/api/publisher/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resourceId: "resource-id",
      moduleId: "example-module",
    }),
  });
  assert.equal(response.status, 401);
  const body = (await response.json()) as { code?: string };
  assert.equal(body.code, "publisher_token_invalid");
});

async function get(pathname: string): Promise<string> {
  const response = await fetch(`${origin}${pathname}`);
  assert.equal(response.status, 200, `${pathname} should return HTTP 200`);
  return response.text();
}

async function waitForServer(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error(
    `Flow test server did not start: ${String(lastError)}\n${serverOutput}`,
  );
}
