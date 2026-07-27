import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { after, before, test } from "node:test";

const port = 31_000 + (process.pid % 1_000);
const origin = `http://localhost:${port}`;
let server: ChildProcess;
let serverOutput = "";

before(async () => {
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
      env: { ...process.env },
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

test("home-to-library discovery flow renders searchable catalog content", async () => {
  const home = await get("/");
  assert.match(home, /Savage Library/);
  assert.match(home, /Search library/);
  assert.match(home, /Foundry VTT Modules/);

  const library = await get(
    "/library?q=crafting&type=module&system=dnd5e&foundry=13&sort=most-downloaded",
  );
  assert.match(library, /Savage Craft/);
  assert.match(library, /matching/);
  assert.doesNotMatch(library, /Vanguard Class/);

  const tagSearch = await get("/library?q=Automation");
  assert.match(tagSearch, /Savage Craft/);
});

test("resource detail flow exposes attribution, compatibility, and manifest actions", async () => {
  const details = await get("/resources/savage-craft");
  assert.match(details, /José Felipe/);
  assert.match(details, /Foundry support/);
  assert.match(details, /Installation instructions/);
  assert.match(details, /Copy manifest/);
  assert.match(details, /All rights reserved/);
  assert.doesNotMatch(details, /<h2>Files<\/h2>/);
});

test("category and discovery metadata routes are available", async () => {
  const category = await get("/categories/foundry-modules");
  assert.match(category, /Foundry VTT Modules/);
  assert.match(category, /Savage Training/);

  const sitemap = await get("/sitemap.xml");
  assert.match(sitemap, /resources\/savage-craft/);

  const robots = await get("/robots.txt");
  assert.match(robots, /Disallow: \/admin/);
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
