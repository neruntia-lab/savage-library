import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE, LINK_FILE } from "./publisher-config.mjs";

/** Package local source only: no symlinks, secrets, nested ZIPs, or publisher metadata. */
export function packageModule(directory, manifest) {
  const ignored = new Set([
    ".git",
    ".next",
    "node_modules",
    LINK_FILE,
    CONFIG_FILE,
    ".savageignore",
    ...readIgnore(directory),
  ]);
  const zip = new AdmZip();
  function visit(relative = "") {
    for (const name of readdirSync(join(directory, relative)).sort()) {
      const resourcePath = relative ? `${relative}/${name}` : name;
      if (
        name === ".env" ||
        name.startsWith(".env.") ||
        name.toLowerCase().endsWith(".zip") ||
        [...ignored].some(
          (entry) =>
            resourcePath === entry ||
            resourcePath.endsWith(`/${entry}`) ||
            resourcePath.startsWith(`${entry}/`) ||
            resourcePath.includes(`/${entry}/`),
        )
      )
        continue;
      const fullPath = join(directory, resourcePath);
      const stat = lstatSync(fullPath);
      if (stat.isSymbolicLink())
        throw new Error(`Symbolic links cannot be packaged: ${resourcePath}`);
      if (stat.isDirectory()) visit(resourcePath);
      else if (stat.isFile()) {
        const entryName = `${manifest.id}/${resourcePath}`;
        zip.addFile(entryName, readFileSync(fullPath));
        zip.getEntry(entryName).header.time = stat.mtime;
      }
    }
  }
  visit();
  const bytes = zip.toBuffer();
  return {
    manifest,
    bytes,
    checksum: createHash("sha256").update(bytes).digest("hex"),
  };
}

function readIgnore(directory) {
  const ignorePath = join(directory, ".savageignore");
  if (!existsSync(ignorePath)) return [];
  return readFileSync(ignorePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\/|\/$/g, ""))
    .filter((line) => line && !line.startsWith("#") && !line.includes("*"));
}
