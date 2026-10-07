import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
