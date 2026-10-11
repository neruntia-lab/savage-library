import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, expect } from "@playwright/test";

const origin = process.env.PREVIEW_ORIGIN ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Use a read-only local preview.");
fs.mkdirSync("work/patreon-pause", { recursive: true });
const browser = await chromium.launch({
  ...(process.env.SAVAGE_VISUAL_BROWSER
    ? { executablePath: process.env.SAVAGE_VISUAL_BROWSER }
    : {}),
});
try {
  for (const width of [390, 820, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    for (const signedIn of [false, true]) {
      if (signedIn) {
        await page.goto(`${origin}/admin/login`);
        await page.locator('input[type="password"]').fill("local-preview");
        await page.getByRole("button", { name: "Enter the dashboard" }).click();
        await page.waitForURL("**/admin");
      }
      await page.goto(`${origin}/account`, { waitUntil: "networkidle" });
      await expect(
        page.getByRole("link", { name: "Link Patreon", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Sign in with Patreon", exact: true }),
      ).toHaveCount(0);
      await expect(page.getByRole("status")).toContainText(
        "New Patreon connections are temporarily unavailable",
      );
      if (!signedIn)
        await expect(page.locator('input[type="email"]')).toBeVisible();
      else
        await expect(
          page.getByRole("link", { name: "Browse the library" }),
        ).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
      );
      await page.screenshot({
        path: `work/patreon-pause/${width}-${signedIn ? "signed-in" : "signed-out"}.png`,
        fullPage: true,
      });
    }
    await page.close();
    console.log(`Paused account layout verified at ${width}px`);
  }
} finally {
  await browser.close();
}
