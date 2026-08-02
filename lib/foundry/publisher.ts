import AdmZip from "adm-zip";

export type FoundryManifest = {
  id: string;
  title: string;
  description?: string;
  version: string;
  authors?: Array<{
    name: string;
    email?: string;
    url?: string;
    discord?: string;
  }>;
  compatibility?: {
    minimum?: string;
    verified?: string;
    maximum?: string;
  };
  url?: string;
  manifest?: string;
  download?: string;
  relationships?: unknown;
  [key: string]: unknown;
};

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const MODULE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FOUNDRY_VERSION_PATTERN = /^\d+(?:\.\d+){0,2}$/;

export function inspectFoundryModule(
  bytes: Uint8Array,
  expectedModuleId?: string | null,
): { manifest: FoundryManifest | null; errors: string[] } {
  const errors: string[] = [];
  let zip: AdmZip;
  try {
    zip = new AdmZip(Buffer.from(bytes));
  } catch {
    return { manifest: null, errors: ["The uploaded file is not a readable ZIP archive."] };
  }

  const entries = zip.getEntries();
  if (!entries.length) errors.push("The ZIP archive is empty.");
  for (const entry of entries) {
    const normalized = entry.entryName.replaceAll("\\", "/");
    if (
      normalized.startsWith("/") ||
      /^[A-Za-z]:\//.test(normalized) ||
      normalized.split("/").includes("..")
    ) {
      errors.push(`Unsafe archive path: ${entry.entryName}`);
    }
    const parts = normalized.split("/").filter(Boolean);
    const fileName = parts.at(-1)?.toLowerCase() ?? "";
    if (
      fileName === ".savage-library.json" ||
      fileName === ".env" ||
      fileName === ".env.local"
    ) {
      errors.push(`Publisher credentials or environment files are not allowed: ${entry.entryName}`);
    }
    if (parts.length > 1 && fileName.endsWith(".zip")) {
      errors.push(`Nested ZIP archives are not allowed: ${entry.entryName}`);
    }
  }

  const manifests = entries.filter(
    (entry) =>
      !entry.isDirectory &&
      entry.entryName.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ===
        "module.json",
  );
  if (manifests.length !== 1) {
    errors.push("The archive must contain exactly one module.json file.");
    return { manifest: null, errors };
  }

  const manifestEntry = manifests[0];
  const parts = manifestEntry.entryName
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean);
  if (parts.length !== 2) {
    errors.push("module.json must be inside one top-level module directory.");
  }

  let manifest: FoundryManifest;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString("utf8")) as FoundryManifest;
  } catch {
    return { manifest: null, errors: [...errors, "module.json is not valid JSON."] };
  }

  if (!manifest.id || !MODULE_ID_PATTERN.test(manifest.id)) {
    errors.push("The manifest id must use lowercase letters, numbers, and hyphens.");
  }
  if (!manifest.title?.trim()) errors.push("The manifest title is required.");
  if (!manifest.description?.trim()) {
    errors.push("The manifest description is required by Foundry VTT.");
  }
  if (!manifest.version || !VERSION_PATTERN.test(manifest.version)) {
    errors.push("The manifest version must be a semantic version such as 1.2.0.");
  }
  if (parts[0] && manifest.id && parts[0] !== manifest.id) {
    errors.push("The top-level module directory must match the manifest id.");
  }
  if (manifest.id) {
    const unexpected = entries.find((entry) => {
      const first = entry.entryName
        .replaceAll("\\", "/")
        .split("/")
        .filter(Boolean)[0];
      return first && first !== manifest.id;
    });
    if (unexpected) {
      errors.push("The archive must contain only the module's top-level directory.");
    }
  }
  if (expectedModuleId && manifest.id !== expectedModuleId) {
    errors.push(`This resource is linked to module id "${expectedModuleId}".`);
  }
  const compatibility = manifest.compatibility;
  for (const [label, value] of Object.entries(compatibility ?? {})) {
    if (
      value != null &&
      (typeof value !== "string" || !FOUNDRY_VERSION_PATTERN.test(value))
    ) {
      errors.push(`Foundry compatibility ${label} is invalid.`);
    }
  }
  return { manifest, errors: [...new Set(errors)] };
}

export function isFoundryVersion(value: string | undefined): boolean {
  return !value || FOUNDRY_VERSION_PATTERN.test(value);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const source = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", source);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPublisherToken(token: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(token));
}

export function publicManifest(
  snapshot: FoundryManifest,
  input: {
    baseUrl: string;
    slug: string;
    versionId: string;
    description?: string;
    authorName?: string;
  },
): FoundryManifest {
  const description = snapshot.description?.trim() || input.description?.trim();
  const authors =
    Array.isArray(snapshot.authors) && snapshot.authors.length
      ? snapshot.authors
      : input.authorName?.trim()
        ? [{ name: input.authorName.trim() }]
        : undefined;
  return {
    ...snapshot,
    ...(description ? { description } : {}),
    ...(authors ? { authors } : {}),
    url: `${input.baseUrl}/resources/${input.slug}`,
    manifest: `${input.baseUrl}/api/foundry/modules/${input.slug}/module.json`,
    download: `${input.baseUrl}/api/foundry/modules/${input.slug}/releases/${input.versionId}/module.zip`,
  };
}
