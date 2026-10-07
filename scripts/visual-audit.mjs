import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const origin = process.env.PREVIEW_ORIGIN ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Visual audits run only against a local preview.");
const output = path.join(process.cwd(), "work", "visual-audit");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.SAVAGE_VISUAL_BROWSER
    ? { executablePath: process.env.SAVAGE_VISUAL_BROWSER }
    : {}),
});
const results = [];
try {
  for (const width of [390, 820, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    async function capture(name, url) {
      if (url) await page.goto(origin + url, { waitUntil: "networkidle" });
      await page.waitForLoadState("networkidle");
      if (name !== "loading-state")
        await page
          .locator('[aria-label="Loading content"]')
          .first()
          .waitFor({ state: "hidden", timeout: 30000 });
      if (name === "wizard-6")
        await page
          .frameLocator('iframe[title="Resource preview"]')
          .getByRole("heading", { name: "Savage Craft", exact: true })
          .waitFor();
      await page.screenshot({
        path: path.join(output, `${width}-${name}.png`),
        fullPage: true,
      });
      const layout = await page.evaluate(() => ({
        title: document.title,
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        overflow: Array.from(document.querySelectorAll("main *"))
          .filter((element) => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return (
              box.width > 0 &&
              style.position !== "fixed" &&
              (box.right > innerWidth + 2 || box.left < -2)
            );
          })
          .slice(0, 8)
          .map((element) => `${element.tagName}.${element.className}`),
      }));
      results.push({ width, name, ...layout, errors: [...failures] });
      console.log(
        `${width} ${name}: ${layout.document > width + 2 ? "OVERFLOW" : "aligned"}`,
      );
    }
    await capture("home", "/");
    if (width < 960) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await capture("menu-open");
      await page.keyboard.press("Escape");
    }
    for (const [name, url] of [
      ["library", "/library"],
      ["search", "/library?q=crafting"],
      ["empty", "/library?q=xyz-no-resource"],
      ["modules", "/categories/foundry-modules"],
      ["macros", "/categories/macros"],
      ["classes", "/categories/classes"],
      ["subclasses", "/categories/subclasses"],
      ["pdfs", "/categories/pdfs"],
      ["resource", "/resources/savage-craft"],
      ["pdf-resource", "/resources/foundry-module-installation-guide"],
      ["account", "/account"],
      ["privacy", "/privacy"],
      ["terms", "/terms"],
      ["not-found", "/missing-page"],
      ["login", "/admin/login"],
    ])
      await capture(name, url);
    await page.locator('input[type="password"]').fill("local-preview");
    await page.getByRole("button", { name: "Enter the dashboard" }).click();
    await page.waitForURL("**/admin");
    await capture("admin");
    for (const name of ["Taxonomy", "Appearance", "Patreon", "CLI Access"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      await page.waitForLoadState("networkidle");
      await capture(`admin-${name.toLowerCase().replaceAll(" ", "-")}`);
    }
    await capture("new-resource", "/admin/resources/new");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForTimeout(300);
    const invalid = await page.locator('[aria-invalid="true"]').count();
    if (!invalid)
      throw new Error("Wizard required field feedback was not shown.");
    await capture("wizard-required");
    for (let step = 1; step <= 6; step++) {
      await capture(`wizard-${step}`, `/dev/preview?step=${step}`);
    }
    for (const type of ["pdf", "macro", "class", "subclass"])
      await capture(`wizard-${type}`, `/dev/preview?step=4&type=${type}`);
    await capture("loading-state", "/dev/preview?screen=loading");
    await capture("error-state", "/dev/preview?screen=error");
    await page.goto(origin + "/dev/preview?step=2", {
      waitUntil: "networkidle",
    });
    await page.route("**/api/resources/*/wizard", (route) =>
      route.request().method() === "PUT" ? route.abort() : route.continue(),
    );
    await page.locator('[name="enTitle"]').fill("Unsaved example title");
    await page
      .getByRole("button", { name: "Save and continue", exact: true })
      .click();
    await page
      .locator(".wizard-actions")
      .getByText(/The connection was interrupted/)
      .waitFor();
    if (
      (await page.locator('[name="enTitle"]').inputValue()) !==
      "Unsaved example title"
    )
      throw new Error("Network failure discarded the wizard edits.");
    if (
      !(await page
        .getByRole("button", { name: "Save and continue", exact: true })
        .isEnabled())
    )
      throw new Error("Network failure left the wizard busy.");
    await capture("wizard-network-error");
    await page.unroute("**/api/resources/*/wizard");
    await capture("editor", "/admin/resources/resource-savage-craft");
    await capture(
      "draft-preview",
      "/admin/resources/resource-savage-craft/preview",
    );
    await capture("logout", "/logout");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL(origin + "/");
    await page.goto(origin + "/admin", { waitUntil: "networkidle" });
    if (!page.url().includes("/admin/login"))
      throw new Error("Signing out did not end the administrator session.");
    await capture("signed-out");
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify(results, null, 2),
  );
}
if (
  results.some(
    (result) => result.document > result.viewport + 2 || result.errors.length,
  )
)
  process.exitCode = 1;
