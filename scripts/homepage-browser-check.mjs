import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "@playwright/test";

const origin = process.env.PREVIEW_ORIGIN ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
  throw new Error(
    "Run this check only against the read-only local design preview.",
  );
}
const output = "work/homepage-browser";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.SAVAGE_VISUAL_BROWSER
    ? { executablePath: process.env.SAVAGE_VISUAL_BROWSER }
    : {}),
});
try {
  for (const width of [320, 390, 820, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    async function capture(name) {
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => scrollTo(0, 0));
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
      );
      await page.screenshot({
        path: `${output}/${width}-${name}.png`,
        fullPage: true,
      });
    }
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    assert.equal(await page.locator('input[type="search"]').count(), 1);
    assert.equal(await page.locator(".resource-card").count(), 5);
    assert.equal(await page.locator(".category-card,.pagination").count(), 0);
    await capture("catalog");
    const toggle = page.getByRole("button", { name: /^Filters/ });
    if (await toggle.isVisible()) await toggle.click();
    await capture("filters");
    await page
      .getByRole("combobox", { name: "Resource type", exact: true })
      .selectOption("module");
    await page
      .getByRole("combobox", { name: "Sort", exact: true })
      .selectOption("alphabetical");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await page.waitForURL(
      (url) =>
        url.pathname === "/" && url.searchParams.get("type") === "module",
    );
    assert.equal(await page.locator(".resource-card").count(), 2);
    assert.equal(new URL(page.url()).hash, "#library");
    await page.locator("#home-search").fill("crafting");
    await page.getByRole("button", { name: "Search the archive" }).click();
    await page.waitForURL((url) => url.searchParams.get("q") === "crafting");
    assert.equal(new URL(page.url()).searchParams.get("type"), "module");
    assert.equal(new URL(page.url()).searchParams.get("sort"), "alphabetical");
    assert.equal(await page.locator(".resource-card").count(), 1);
    await page
      .getByRole("combobox", { name: "Sort", exact: true })
      .selectOption("most-downloaded");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await page.waitForURL(
      (url) => url.searchParams.get("sort") === "most-downloaded",
    );
    assert.equal(new URL(page.url()).searchParams.get("q"), "crafting");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("#home-search").inputValue(), "crafting");
    assert.equal(
      await page
        .getByRole("combobox", { name: "Resource type", exact: true })
        .inputValue(),
      "module",
    );
    await capture("combined");
    await page.getByRole("link", { name: "Clear", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/" && !url.search);
    assert.equal(await page.locator(".resource-card").count(), 5);
    assert.equal(await page.locator("#home-search").inputValue(), "");
    await page
      .locator(".resource-card .tag")
      .filter({ hasText: "Crafting" })
      .first()
      .click();
    await page.waitForURL(
      (url) =>
        url.pathname === "/" && url.searchParams.get("tag") === "crafting",
    );
    assert.equal(new URL(page.url()).hash, "#library");
    await page.goto(`${origin}/?q=no-matching-entry`, {
      waitUntil: "networkidle",
    });
    assert.equal(await page.locator(".resource-card").count(), 0);
    assert.ok(
      await page
        .getByRole("heading", { name: "No resources found" })
        .isVisible(),
    );
    await capture("empty");
    assert.deepEqual(errors, []);
    console.log(
      `${width}px: catalog, filters, search preservation, reload, clear, tags, and empty state passed`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
