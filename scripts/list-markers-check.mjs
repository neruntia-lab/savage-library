import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, expect } from "@playwright/test";

const origin = process.env.PREVIEW_ORIGIN ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Run only against the read-only local preview.");
const output = "work/list-markers";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.SAVAGE_VISUAL_BROWSER
    ? { executablePath: process.env.SAVAGE_VISUAL_BROWSER }
    : {}),
});
try {
  for (const width of [390, 820, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    for (const [name, path] of [
      ["legal", "/legal"],
      ["resource", "/resources/savage-craft"],
      ["wiki", "/wiki/sample-module-installation"],
    ]) {
      await page.goto(origin + path, { waitUntil: "networkidle" });
      await expect(page.locator("h1")).toBeVisible();
      const listStyles = await page
        .locator(
          ".legal-content ul, .markdown-content ul, .markdown-content ol, .detail-list, .patch-note-list",
        )
        .evaluateAll((lists) =>
          lists.map((list) => ({
            tag: list.tagName,
            type: getComputedStyle(list).listStyleType,
          })),
        );
      for (const list of listStyles)
        assert.notEqual(list.type, "none", `${name}: ${list.tag}`);
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
    // Exercise shared styles with nested/wrapped content without changing stored content.
    await page.evaluate(() => {
      const panel = document.createElement("section");
      panel.className = "content-section";
      panel.id = "list-style-fixture";
      panel.innerHTML =
        '<div class="markdown-content"><ul><li>First bullet with a longer explanation that wraps naturally at phone widths.<ul><li>Second level<ul><li>Third level</li></ul></li></ul></li></ul><ol start="4"><li>Number four</li><li>Number five</li></ol></div><ul class="patch-note-list"><li>Fixed module playback.</li></ul><ul class="publisher-errors"><li>Required correction.</li></ul><ul class="candidate-warnings"><li>Review this field.</li></ul>';
      document.querySelector("main .container").append(panel);
    });
    const fixture = page.locator("#list-style-fixture");
    assert.deepEqual(
      await fixture
        .locator(".markdown-content ul")
        .evaluateAll((lists) =>
          lists.map((list) => getComputedStyle(list).listStyleType),
        ),
      ["disc", "circle", "square"],
    );
    await expect(fixture.locator("ol")).toHaveAttribute("start", "4");
    assert.equal(
      await fixture
        .locator("ol")
        .evaluate((list) => getComputedStyle(list).listStyleType),
      "decimal",
    );
    for (const cls of [
      "patch-note-list",
      "publisher-errors",
      "candidate-warnings",
    ]) {
      assert.equal(
        await fixture
          .locator(`.${cls}`)
          .evaluate((list) => getComputedStyle(list).listStyleType),
        "disc",
      );
    }
    assert.equal(
      await fixture
        .locator("li")
        .first()
        .evaluate((item) => getComputedStyle(item).display),
      "list-item",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
    );
    await fixture.screenshot({ path: `${output}/${width}-nested.png` });
    await page.goto(`${origin}/admin/login`);
    await page.locator('input[type="password"]').fill("local-preview");
    await page.getByRole("button", { name: "Enter the dashboard" }).click();
    await page.waitForURL("**/admin");
    await page.goto(`${origin}/dev/preview?step=6`, {
      waitUntil: "networkidle",
    });
    assert.equal(
      await page
        .locator(".wizard-stepper")
        .evaluate((list) => getComputedStyle(list).listStyleType),
      "none",
    );
    for (const type of await page
      .locator(".wizard-check-list ul")
      .evaluateAll((lists) =>
        lists.map((list) => getComputedStyle(list).listStyleType),
      ))
      assert.equal(type, "none");
    await page.close();
    console.log(`List markers verified at ${width}px`);
  }
} finally {
  await browser.close();
}
