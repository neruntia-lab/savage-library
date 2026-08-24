export type ReleaseNotes = {
  version: string;
  changes: string[];
};

const RESULT_VERBS = /^(Added|Fixed|Improved|Updated|Removed)\b/;

export function validateReleaseNotes(
  value: unknown,
  expectedVersion: string,
): { success: true; data: ReleaseNotes } | { success: false; errors: string[] } {
  if (!isRecord(value)) {
    return { success: false, errors: ["release notes are required for an existing module update."] };
  }
  const errors: string[] = [];
  const version = typeof value.version === "string" ? value.version.trim() : "";
  if (version !== expectedVersion) {
    errors.push(`release.version must match module.json version ${expectedVersion}.`);
  }
  if (!Array.isArray(value.changes) || value.changes.length === 0) {
    errors.push("release.changes must contain at least one concise patch note.");
  }
  const changes = Array.isArray(value.changes)
    ? value.changes.map((change) => typeof change === "string" ? change.trim() : "")
    : [];
  if (changes.length > 20) errors.push("release.changes may contain at most 20 entries.");
  const seen = new Set<string>();
  for (const [index, change] of changes.entries()) {
    const label = `release.changes[${index}]`;
    if (!change) errors.push(`${label} cannot be empty.`);
    else if (change.length > 160) errors.push(`${label} must be 160 characters or fewer.`);
    else if (/\r|\n/.test(change)) errors.push(`${label} must be one sentence on one line.`);
    else if (!RESULT_VERBS.test(change)) errors.push(`${label} must begin with Added, Fixed, Improved, Updated, or Removed.`);
    const normalized = change.toLocaleLowerCase("en-US");
    if (change && seen.has(normalized)) errors.push(`${label} duplicates another patch note.`);
    seen.add(normalized);
  }
  return errors.length
    ? { success: false, errors }
    : { success: true, data: { version, changes } };
}

export function serializeReleaseNotes(changes: string[]) {
  return changes.map((change) => `- ${change}`).join("\n");
}

export function parseReleaseNotes(summary: string, details: string) {
  if (summary !== "Patch notes") return null;
  const changes = details
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!changes.length || changes.some((line) => !line.startsWith("- "))) return null;
  return changes.map((line) => line.slice(2).trim()).filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
