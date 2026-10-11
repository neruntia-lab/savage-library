import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

// Inventory only deployable/tracked project material. Never print file contents or secrets.
const excluded =
  /^(?:\.codex-remote-attachments|share|Mods|Macros|Logo|work|node_modules|\.next|\.git|\.vercel)\//;
const names = [
  ...new Set(
    execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n"),
  ),
]
  .filter(
    (name) =>
      name && !excluded.test(name) && !/^\.env(?!\.example$)/.test(name),
  )
  .sort();
const rows = names.flatMap((name) => {
  try {
    const size = statSync(name).size;
    const text =
      /\.(?:tsx?|m?js|css|md|sql|json)$/.test(name) || name === ".env.example";
    const lines = text
      ? readFileSync(name, "utf8").split(/\r?\n/).length
      : null;
    return [
      {
        path: name,
        area: name.split("/")[0],
        extension: path.extname(name),
        size,
        lines,
      },
    ];
  } catch {
    return [];
  }
});
if (process.argv.includes("--markdown")) {
  console.log(
    "# Development audit inventory\n\nGenerated with `node scripts/audit-inventory.mjs --markdown`. Binary assets are inventoried, not interpreted as source. Dependencies, build output, attachments, shareable exports, and separate Foundry module code are excluded.\n",
  );
  console.log("| File | Lines (text) | Bytes |\n| --- | ---: | ---: |");
  for (const row of rows)
    console.log(`| \`${row.path}\` | ${row.lines ?? "binary"} | ${row.size} |`);
} else
  console.log(JSON.stringify({ fileCount: rows.length, files: rows }, null, 2));
