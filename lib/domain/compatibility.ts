import type { CompatibilityStatus } from "./resource";

export const SUPPORTED_FOUNDRY_VERSIONS = ["12", "13", "14"] as const;
export const CURRENT_FOUNDRY_VERSION = "13";

export function deriveCompatibilityStatus(input: {
  minimum?: string | null;
  verified?: string | null;
  maximum?: string | null;
}): CompatibilityStatus {
  const current = Number(CURRENT_FOUNDRY_VERSION);
  const minimum = parseMajor(input.minimum);
  const verified = parseMajor(input.verified);
  const maximum = parseMajor(input.maximum);

  if (maximum !== null && maximum < current) return "outdated";
  if (minimum !== null && minimum > current) return "unsupported";
  if (verified === current) return "verified";
  if (
    minimum !== null &&
    minimum <= current &&
    (maximum === null || maximum >= current)
  ) {
    return "compatible";
  }
  return "untested";
}

function parseMajor(value?: string | null): number | null {
  if (!value) return null;
  const major = Number.parseInt(value.split(".")[0], 10);
  return Number.isFinite(major) ? major : null;
}
