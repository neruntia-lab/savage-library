import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, expect } from "@playwright/test";
const origin = process.env.PREVIEW_ORIGIN ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Use the read-only local preview.");
const output = "work/wiki-browser";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SAVAGE_VISUAL_BROWSER,
});
try {
  for (const width of [390, 820, 1440]) {
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
        `${width} ${name}: overflow`,
      );
      await page.screenshot({
        path: `${output}/${width}-${name}.png`,
        fullPage: true,
      });
    }
    await page.goto(origin, { waitUntil: "networkidle" });
    const nav = page.getByRole("navigation", {
      name: width < 960 ? "Mobile navigation" : "Primary navigation",
      exact: true,
    });
    if (width < 960)
      await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(nav.getByRole("link")).toHaveCount(3);
    assert.deepEqual(await nav.getByRole("link").allTextContents(), [
      "Library",
      "Wiki",
      "Terms & Privacy",
    ]);
    await expect(
      nav.getByRole("link", { name: "Library", exact: true }),
    ).toHaveAttribute("href", "/");
    await capture("navigation");
    await nav.getByRole("link", { name: "Wiki", exact: true }).click();
    await page.waitForURL("**/wiki");
    await capture("wiki");
    await expect(page.locator(".wiki-card")).toHaveCount(2);
    const columns = await page
      .locator(".wiki-card-grid")
      .evaluate(
        (grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      );
    assert.equal(columns, width <= 640 ? 1 : width <= 960 ? 2 : 3);
    await expect(page.locator(".wiki-topic-group")).toHaveCount(0);
    await page
      .getByRole("link", { name: "Getting started with a module", exact: true })
      .click();
    await page.waitForURL("**/wiki/sample-module-installation?lang=en");
    await capture("guide");
    await page
      .getByRole("navigation", { name: "On this page" })
      .getByRole("link", { name: "Install the module", exact: true })
      .click();
    await expect(page.locator("#wiki-section-2")).toBeVisible();
    await page.getByRole("link", { name: "Español", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Primeros pasos con un módulo",
        exact: true,
      }),
    ).toBeVisible();
    await capture("spanish");
    await page.goto(`${origin}/wiki/sample-library-help?lang=es`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByRole("status")).toContainText(
      "This translation is not available",
    );
    await page.goto(`${origin}/wiki?q=nothing-matches`, {
      waitUntil: "networkidle",
    });
    await capture("empty");
    await page.goto(`${origin}/legal`, { waitUntil: "networkidle" });
    await capture("legal");
    await page
      .getByRole("navigation", { name: "Legal sections" })
      .getByRole("link", { name: "Privacy policy" })
      .click();
    await expect(page.locator("#privacy-title")).toBeVisible();
    await page.goto(`${origin}/admin/login`, { waitUntil: "networkidle" });
    await page.locator('input[type="password"]').fill("local-preview");
    await page.getByRole("button", { name: "Enter the dashboard" }).click();
    await page.waitForURL("**/admin");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "Wiki", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit guide" })).toHaveCount(
      3,
    );
    await expect(
      page.getByText("Starter draft — add documentation"),
    ).toBeVisible();
    await capture("admin");
    const starter = page
      .locator(".wiki-topic")
      .filter({ hasText: "Starter draft — add documentation" });
    await starter.getByRole("button", { name: "Edit guide" }).click();
    await expect(page.locator('input[name="en.title"]')).toHaveValue(
      "Savage Training",
    );
    await expect(page.locator('textarea[name="en.body"]')).toHaveValue("");
    await capture("starter");
    await page.getByRole("button", { name: "← Guide list" }).click();
    await page
      .getByRole("button", { name: "+ New guide", exact: true })
      .click();
    await page.locator('input[name="slug"]').fill("new-guide");
    await page.locator('input[name="en.title"]').fill("Test guide");
    await page
      .locator('textarea[name="en.body"]')
      .fill("## Settings\n\nConfigure **audio** settings.");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Guide preview" }),
    ).toBeVisible();
    await capture("editor-preview");
    await page.locator('input[name="en.title"]').fill("");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.locator('input[name="en.title"]')).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.locator('input[name="en.title"]')).toBeFocused();
    await capture("validation");
    await page.locator('input[name="en.title"]').fill("Test guide");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("read-only");
    await expect(page.locator('textarea[name="en.body"]')).toHaveValue(
      "## Settings\n\nConfigure **audio** settings.",
    );
    assert.deepEqual(errors, []);
    console.log(
      `${width}px: navigation, guides, language, legal sections, admin preview, validation and read-only save safety passed`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
