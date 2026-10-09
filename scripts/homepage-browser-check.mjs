import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, expect } from "@playwright/test";

const origin = process.env.PREVIEW_ORIGIN ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Run only against the read-only local preview.");
const output = "work/homepage-browser";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.SAVAGE_VISUAL_BROWSER
    ? { executablePath: process.env.SAVAGE_VISUAL_BROWSER }
    : {}),
});
try {
  for (const width of [320, 390, 620, 820, 930, 960, 1440]) {
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
      if (await page.locator(".hero.hero-image").count())
        assert.ok(
          await page.locator(".hero.hero-image").evaluate((hero) => {
            const bounds = hero.getBoundingClientRect();
            const frame = getComputedStyle(hero, "::after");
            const left = bounds.left + parseFloat(frame.left);
            const right = bounds.right - parseFloat(frame.right);
            const top = bounds.top + parseFloat(frame.top);
            const bottom = bounds.bottom - parseFloat(frame.bottom);
            return (
              [
                ...hero.querySelectorAll(
                  ".hero-search, .celestial-ornament, h1, .archive-subtitle",
                ),
              ].every((element) => {
                const box = element.getBoundingClientRect();
                return (
                  box.left >= left + 4 &&
                  box.right <= right - 4 &&
                  box.top >= top + 4 &&
                  box.bottom <= bottom - 4
                );
              }) && frame.pointerEvents === "none"
            );
          }),
          `Banner frame intersects content at ${width}px (${name})`,
        );
      await page.screenshot({
        path: `${output}/${width}-${name}.png`,
        fullPage: true,
      });
    }
    const type = page.getByRole("combobox", {
      name: "Source type",
      exact: true,
    });
    const system = page.getByRole("combobox", {
      name: "Game system",
      exact: true,
    });
    const sort = page.getByRole("combobox", { name: "Sort by", exact: true });
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await expect(page.locator("select")).toHaveCount(3);
    await expect(page.locator('input[type="search"]')).toHaveCount(1);
    await expect(page.locator(".resource-card")).toHaveCount(5);
    await expect(
      page.locator(
        ".category-card,.pagination,.filter-toggle,.resource-card a.tag",
      ),
    ).toHaveCount(0);
    assert.equal(await page.locator("fieldset select[name=sort]").count(), 0);
    await capture("catalog");
    await page
      .locator("#home-search")
      .fill(
        "A long module title with additional search words to verify contained search text",
      );
    await page.locator("#home-search").focus();
    await capture("search-focus");
    await page.locator("#home-search").fill("");
    if (process.argv.includes("--banner-only")) {
      await page.locator("html").evaluate((element) => {
        element.style.zoom = "2";
      });
      await capture("zoom");
      await page.locator("html").evaluate((element) => {
        element.style.zoom = "";
      });
      console.log(
        `${width}px: banner containment, long search, focus, and 200% zoom passed`,
      );
      await context.close();
      continue;
    }
    if (width === 390) {
      await page.route("**/*", async (route) => {
        if (route.request().headers().rsc)
          await new Promise((resolve) => setTimeout(resolve, 350));
        await route.continue();
      });
    }
    await type.focus();
    await type.selectOption("module");
    if (width === 390)
      await expect(
        page.getByRole("status").filter({ hasText: "Updating results…" }),
      ).toBeVisible();
    await page.waitForURL((url) => url.searchParams.get("type") === "module");
    await expect(page.locator(".resource-card")).toHaveCount(2);
    await expect(type).toBeFocused();
    await sort.selectOption("alphabetical");
    await page.waitForURL(
      (url) => url.searchParams.get("sort") === "alphabetical",
    );
    await system.selectOption("dnd5e");
    await page.waitForURL((url) => url.searchParams.get("system") === "dnd5e");
    await page.locator("#home-search").fill("crafting");
    await page.getByRole("button", { name: "Search the archive" }).click();
    await page.waitForURL((url) => url.searchParams.get("q") === "crafting", {
      waitUntil: "commit",
    });
    // The banner uses a native GET form; wait for the new page to hydrate.
    await page.waitForLoadState("networkidle");
    assert.equal(new URL(page.url()).searchParams.get("type"), "module");
    assert.equal(new URL(page.url()).searchParams.get("system"), "dnd5e");
    assert.equal(new URL(page.url()).searchParams.get("sort"), "alphabetical");
    await expect(page.locator(".resource-card")).toHaveCount(1);
    await sort.selectOption("most-downloaded");
    await page.waitForURL(
      (url) => url.searchParams.get("sort") === "most-downloaded",
    );
    assert.equal(new URL(page.url()).searchParams.get("q"), "crafting");
    await page.reload({ waitUntil: "networkidle" });
    await expect(type).toHaveValue("module");
    await expect(system).toHaveValue("dnd5e");
    await capture("combined");
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await page.waitForURL(
      (url) => !url.searchParams.has("type") && !url.searchParams.has("system"),
    );
    assert.equal(new URL(page.url()).searchParams.get("q"), "crafting");
    assert.equal(
      new URL(page.url()).searchParams.get("sort"),
      "most-downloaded",
    );
    await expect(
      page.getByRole("button", { name: "Clear filters" }),
    ).toHaveCount(0);
    await page.goto(
      `${origin}/?tag=nonexistent&author=nonexistent&pricing=premium`,
      { waitUntil: "networkidle" },
    );
    await expect(page.locator(".resource-card")).toHaveCount(5);
    await sort.selectOption("alphabetical");
    await page.waitForURL(
      (url) => url.searchParams.get("sort") === "alphabetical",
    );
    for (const name of ["tag", "author", "pricing"])
      assert.ok(!new URL(page.url()).searchParams.has(name));
    await page.goto(`${origin}/?q=no-matching-entry`, {
      waitUntil: "networkidle",
    });
    await expect(
      page.getByRole("heading", { name: "No resources found" }),
    ).toBeVisible();
    await capture("empty");
    await page.goto(`${origin}/library?page=3&pageSize=1&tag=nonexistent`, {
      waitUntil: "networkidle",
    });
    await type.selectOption("module");
    await page.waitForURL(
      (url) =>
        url.pathname === "/library" &&
        url.searchParams.get("type") === "module",
    );
    assert.ok(!new URL(page.url()).searchParams.has("page"));
    await expect(page.locator(".resource-card")).toHaveCount(2);
    await capture("library");
    await page.goto(
      `${origin}/categories/foundry-modules?category=pdfs&tag=nonexistent`,
      { waitUntil: "networkidle" },
    );
    await expect(page.locator(".resource-card")).toHaveCount(2);
    await sort.selectOption("alphabetical");
    await page.waitForURL(
      (url) =>
        url.pathname === "/categories/foundry-modules" &&
        url.searchParams.get("sort") === "alphabetical",
    );
    await expect(page.locator(".resource-card")).toHaveCount(2);
    await capture("category");
    assert.deepEqual(errors, []);
    console.log(
      `${width}px: compact controls, immediate updates, focus, search, clear, retired links, pagination reset, and category boundary passed`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
