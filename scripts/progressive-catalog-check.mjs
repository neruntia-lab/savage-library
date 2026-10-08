import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

const origin = process.env.PREVIEW_ORIGIN ?? "http://localhost:3400";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Run only against an isolated local stress preview.");
const browser = await chromium.launch({
  ...(process.env.SAVAGE_VISUAL_BROWSER
    ? { executablePath: process.env.SAVAGE_VISUAL_BROWSER }
    : {}),
});
try {
  for (const width of [390, 820, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin, { waitUntil: "networkidle" });
    await expect(page.locator(".resource-card")).toHaveCount(24);
    await page.route("**/api/resources?**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary catalog failure" }),
      }),
    );
    await page.getByRole("link", { name: "Load more", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Temporary catalog failure" }),
    ).toBeVisible();
    await expect(page.locator(".resource-card")).toHaveCount(24);
    await page.unroute("**/api/resources?**");
    await page
      .getByRole("link", { name: "Retry loading more", exact: true })
      .click();
    await expect(page.locator(".resource-card")).toHaveCount(48);
    await page.getByRole("link", { name: "Load more", exact: true }).click();
    await expect(page.locator(".resource-card")).toHaveCount(65);
    await expect(
      page.getByRole("link", { name: "Load more", exact: true }),
    ).toHaveCount(0);
    assert.equal(
      new Set(
        await page
          .locator(".resource-card")
          .evaluateAll((cards) =>
            cards.map((c) =>
              c.querySelector('a[href^="/resources/"]')?.getAttribute("href"),
            ),
          ),
      ).size,
      65,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `${width}px: bounded loading, failure retention, retry, and unique entries passed`,
    );
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(origin);
  await page.getByRole("link", { name: "Load more", exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.get("page"), "2");
  await expect(page.locator(".resource-card")).toHaveCount(24);
  await context.close();
  console.log("Non-JavaScript pagination passed");
} finally {
  await browser.close();
}
