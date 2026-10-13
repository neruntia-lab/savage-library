import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

test("corner artwork stays proportionate and mirrored at every panel corner", () => {
  const svg = readFileSync(
    new URL("../public/ornament-corners.svg", import.meta.url),
    "utf8",
  );
  assert.match(svg, /width="104" height="104" viewBox="0 0 11\.86 11\.97"/);
  assert.match(svg, /preserveAspectRatio="xMinYMin meet"/);
  assert.match(svg, /fill="#c7a14d"/);
  assert.equal((svg.match(/<circle\b/g) ?? []).length, 4);
  assert.equal((svg.match(/<path\b/g) ?? []).length, 1);
  assert.equal((svg.match(/<use href="#corner"/g) ?? []).length, 4);
  assert.equal((svg.match(/<rect\b/g) ?? []).length, 4);
  assert.ok(svg.includes("width:calc(100% - 204.088554px)"));
  assert.ok(svg.includes("height:calc(100% - 206px)"));
  // One-pixel edges share the native centerlines and overlap both corner joins.
  const stems = [...svg.matchAll(/<rect x="([^"]+)" y="103" width="([^"]+)"/g)];
  assert.equal(stems.length, 2);
  const scale = 104 / 11.97;
  const horizontal = [...svg.matchAll(/<rect x="([^"]+)" y="([^"]+)" height="([^"]+)"/g)];
  assert.equal(horizontal.length, 2);
  for (const stem of horizontal) {
    assert.ok(Math.abs(Number(stem[1]) - (11.86 * scale - 1)) < 0.00001);
    assert.equal(Number(stem[3]), 1);
  }
  assert.ok(Math.abs(Number(horizontal[0][2]) + 0.5 - 0.995 * scale) < 0.00001);
  assert.ok(Math.abs(Number(horizontal[1][2]) + 0.5 + 0.995 * scale) < 0.00001);
  assert.ok(Math.abs(Number(stems[0][1]) + 0.5 - 1.015 * scale) < 0.00001);
  assert.equal(Number(stems[0][2]), 1);
  assert.ok(Math.abs(Number(stems[1][1]) + 0.5 + 1.015 * scale) < 0.00001);
  assert.equal((svg.match(/vector-effect="non-scaling-stroke"/g) ?? []).length, 2);
  assert.match(svg, /stroke="#c7a14d" stroke-width="1"/);
  for (const transform of ["scale(-1 1)", "scale(1 -1)", "scale(-1 -1)"]) {
    assert.ok(svg.includes(`transform="${transform}"`));
  }
  assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\bon\w+=/i);
});

test("ornamental frames sit on panel edges without clipping or intercepting controls", () => {
  const css = postcss.parse(
    readFileSync(
      new URL("../app/styles/ornamental.css", import.meta.url),
      "utf8",
    ),
  );
  let frame: postcss.Rule | undefined;
  css.walkRules((rule) => {
    if (
      rule.selector.includes(".publisher-release-card") &&
      rule.selector.endsWith("::before")
    )
      frame = rule;
  });
  assert.ok(frame);
  const values = Object.fromEntries(
    frame.nodes
      .filter((node) => node.type === "decl")
      .map((node) => [node.prop, node.value]),
  );
  assert.equal(values.inset, "-9.644946px -9.818713px");
  assert.equal(values["pointer-events"], "none");
  assert.equal(values["z-index"], "-1");
  assert.match(values.background, /ornament-corners\.svg/);
  let panelOverflow: string | undefined;
  css.walkRules((rule) => {
    if (rule.selector.endsWith(".publisher-release-card")) {
      rule.walkDecls("overflow", (decl) => {
        panelOverflow = decl.value;
      });
    }
  });
  assert.equal(panelOverflow, "visible");
  const responsive = postcss.parse(
    readFileSync(new URL("../app/styles/responsive.css", import.meta.url), "utf8"),
  );
  let mobileSidebarPosition: string | undefined;
  responsive.walkRules(".details-sidebar", (rule) => {
    rule.walkDecls("position", (decl) => { mobileSidebarPosition = decl.value; });
  });
  assert.equal(mobileSidebarPosition, "relative");
});

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
