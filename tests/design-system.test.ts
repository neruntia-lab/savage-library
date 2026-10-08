import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

test("shared list defaults restore markers while wizard controls opt out", () => {
  const foundation = postcss.parse(
    readFileSync(
      new URL("../app/styles/foundation.css", import.meta.url),
      "utf8",
    ),
  );
  const wizard = postcss.parse(
    readFileSync(new URL("../app/styles/wizard.css", import.meta.url), "utf8"),
  );
  function declaration(root: postcss.Root, selector: string, property: string) {
    let result: string | undefined;
    root.walkRules(selector, (rule) => {
      rule.walkDecls(property, (decl) => {
        result = decl.value;
      });
    });
    return result;
  }
  assert.equal(declaration(foundation, "ul", "list-style-type"), "disc");
  assert.equal(declaration(foundation, "ol", "list-style-type"), "decimal");
  assert.equal(declaration(foundation, "ul ul", "list-style-type"), "circle");
  assert.equal(
    declaration(foundation, "ul ul ul", "list-style-type"),
    "square",
  );
  assert.equal(declaration(wizard, ".wizard-stepper", "list-style"), "none");
  assert.equal(
    declaration(wizard, ".wizard-check-list ul", "list-style"),
    "none",
  );
});

function luminance(hex: string) {
  const channels = hex
    .match(/[a-f\d]{2}/gi)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
test("ornamental foreground tokens meet normal-text contrast on their intended surfaces", () => {
  const css = readFileSync(
    new URL("../app/styles/ornamental.css", import.meta.url),
    "utf8",
  );
  const tokens = Object.fromEntries(
    [...css.matchAll(/--(color-[\w-]+):\s*(#[a-f\d]{6});/gi)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  for (const [foreground, background] of [
    ["color-text", "color-primary"],
    ["color-text", "color-plum"],
    ["color-gold-bright", "color-surface"],
    ["color-text-muted", "color-surface"],
    ["color-text-subtle", "color-surface-raised"],
  ]) {
    const first = luminance(tokens[foreground]);
    const second = luminance(tokens[background]);
    const contrast =
      (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    assert.ok(
      contrast >= 4.5,
      `${foreground} on ${background}: ${contrast.toFixed(2)}:1`,
    );
  }
});
