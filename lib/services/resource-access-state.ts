import type { EntitlementResult } from "./entitlements";

export function resourceAccessState(input: {
  preview: boolean;
  protected: boolean;
  signedIn: boolean;
  entitled: boolean;
  denialReason?: EntitlementResult["denialReason"];
  available: boolean;
}) {
  if (input.preview) return "preview";
  if (input.protected && !input.entitled) {
    if (!input.signedIn) return "connect";
    return input.denialReason === "verification_unavailable"
      ? "unverified"
      : "missing-tier";
  }
  return input.available ? "available" : "unavailable";
}
