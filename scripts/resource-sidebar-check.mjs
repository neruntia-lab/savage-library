import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, expect } from "@playwright/test";

const origin = process.env.PREVIEW_ORIGIN ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Run only against the read-only local preview.");
const output = "work/resource-sidebar";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.SAVAGE_VISUAL_BROWSER
    ? { executablePath: process.env.SAVAGE_VISUAL_BROWSER }
    : {}),
});
try {
  for (const width of [390, 820, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    async function capture(name) {
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
    for (const slug of ["savage-craft", "foundry-module-installation-guide"]) {
      await page.goto(`${origin}/resources/${slug}`, {
        waitUntil: "networkidle",
      });
      const sidebar = page.locator(".details-sidebar");
      await expect(sidebar.locator("dt")).toContainText([
        "Compatibility",
        "Version",
        "Required tier",
      ]);
      await expect(page.locator(".resource-hero .status")).toHaveCount(0);
      await expect(sidebar).toContainText("None — Free");
      assert.ok(
        await sidebar
          .locator(":scope > .tag-list")
          .evaluate(
            (tags) => parseFloat(getComputedStyle(tags).marginTop) >= 20,
          ),
      );
      if (slug === "savage-craft") {
        await expect(page.locator(".resource-hero button")).toHaveCount(0);
        await sidebar
          .getByRole("button", { name: "Copy manifest", exact: true })
          .click();
        await expect(
          sidebar.getByRole("button", { name: "Copied", exact: true }),
        ).toBeVisible();
        assert.match(
          await page.evaluate(() => navigator.clipboard.readText()),
          /\/api\/foundry\/modules\/savage-craft\/module\.json$/,
        );
      } else {
        // Read-only catalog examples deliberately have no downloadable files.
        await expect(
          page.locator(".resource-hero .resource-actions"),
        ).toHaveCount(0);
        await expect(
          sidebar.getByRole("button", { name: /Copy manifest/ }),
        ).toHaveCount(0);
      }
      await capture(slug);
    }
    await page.goto(`${origin}/admin/login`);
    await page.locator('input[type="password"]').fill("local-preview");
    await page.getByRole("button", { name: "Enter the dashboard" }).click();
    await page.waitForURL("**/admin");
    await page.goto(`${origin}/admin/resources/resource-savage-craft/preview`, {
      waitUntil: "networkidle",
    });
    await expect(
      page
        .locator(".details-sidebar")
        .getByRole("button", { name: "Copy manifest link" }),
    ).toBeDisabled();
    await expect(page.locator(".resource-hero .status")).toHaveCount(0);
    await capture("preview");
    await context.close();
    console.log(`Resource sidebar verified at ${width}px`);
  }
} finally {
  await browser.close();
}
