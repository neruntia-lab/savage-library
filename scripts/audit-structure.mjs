import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import ts from "typescript";
import postcss from "postcss";

// Read-only, repeatable structural audit. Outputs locations/counts, never source or secrets.
const inventory = JSON.parse(
  execFileSync(process.execPath, ["scripts/audit-inventory.mjs"], {
    encoding: "utf8",
  }),
);
const production = inventory.files.filter(
  (f) =>
    /^(app|components|lib|db|scripts)\//.test(f.path) &&
    /\.(ts|tsx|mjs|js|css)$/.test(f.path),
);
const functions = new Map(),
  imports = new Map();
for (const file of production.filter((f) =>
  /\.(ts|tsx|mjs|js)$/.test(f.path),
)) {
  const source = ts.createSourceFile(
    file.path,
    readFileSync(file.path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const dependencies = [];
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      dependencies.push(node.moduleSpecifier.text);
    if (ts.isFunctionDeclaration(node) && node.body) {
      const body = node.body.getText(source).replace(/\s+/g, " ");
      if (body.length > 150) {
        const key = createHash("sha256").update(body).digest("hex");
        const group = functions.get(key) ?? [];
        group.push({
          file: file.path,
          name: node.name?.text ?? "anonymous",
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        });
        functions.set(key, group);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  imports.set(file.path, dependencies);
}
const css = new Map();
const styles = [
  ...readFileSync("app/globals.css", "utf8").matchAll(/@import "(.+\.css)"/g),
].map((m) => path.posix.normalize(`app/${m[1]}`));
for (const file of styles) {
  postcss
    .parse(readFileSync(file, "utf8"), { from: file })
    .walkRules((rule) => {
      const context = [];
      for (
        let parent = rule.parent;
        parent?.type === "atrule";
        parent = parent.parent
      )
        context.unshift(`${parent.name} ${parent.params}`);
      const key = JSON.stringify([
        context,
        rule.selector,
        rule.nodes.map((n) => n.toString().replace(/\s+/g, " ")),
      ]);
      const entries = css.get(key) ?? [];
      entries.push({
        file,
        line: rule.source.start.line,
        end: rule.source.end.line,
      });
      css.set(key, entries);
    });
}
const chunks = (() => {
  try {
    const files = execFileSync("git", ["ls-files"], { encoding: "utf8" });
    return { trackedFiles: files.trim().split("\n").length };
  } catch {
    return {};
  }
})();
console.log(
  JSON.stringify(
    {
      files: inventory.fileCount,
      sourceLines: production.reduce((sum, f) => sum + f.lines, 0),
      sourceBytes: production.reduce((sum, f) => sum + f.size, 0),
      largest: [...production].sort((a, b) => b.lines - a.lines).slice(0, 15),
      duplicateFunctionBodies: [...functions.values()].filter(
        (g) => g.length > 1,
      ),
      duplicateStyleRules: [...css.values()].filter((g) => g.length > 1),
      stylesheetBytes: styles.reduce(
        (sum, file) => sum + statSync(file).size,
        0,
      ),
      sourceImports: Object.fromEntries(imports),
      ...chunks,
    },
    null,
    2,
  ),
);
