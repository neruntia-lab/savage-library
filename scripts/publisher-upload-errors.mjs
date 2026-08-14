export function publisherUploadError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (
    normalized.includes("publisher_token_invalid") ||
    normalized.includes("publisher token rejected") ||
    normalized.includes("401") ||
    normalized.includes("unauthorized")
  ) {
    return "Publisher authentication was rejected. Rotate the module publisher token in Savage Library, relink this module, and retry once.";
  }
  if (normalized.includes("module_resource_mismatch")) {
    return "The linked catalog resource belongs to a different Foundry module. Link this module to its exact resource and retry.";
  }
  if (normalized.includes("resource_not_found")) {
    return "The linked Savage Library module resource does not exist. Create or locate the correct module resource, rotate its publisher token, and link again.";
  }
  if (normalized.includes("version_conflict")) {
    return "This version already exists with different archive contents. Bump module.json to a new semantic version and validate again.";
  }
  if (normalized.includes("403") || normalized.includes("forbidden")) {
    return "Publisher access was forbidden. Confirm the module is linked to the correct Savage Library resource, then rotate and relink its publisher token.";
  }
  if (
    normalized.includes("private_storage_missing") ||
    normalized.includes("private_storage_rejected") ||
    normalized.includes("private module storage is unavailable") ||
    normalized.includes("503") ||
    normalized.includes("service unavailable")
  ) {
    return "Savage Library private module storage is unavailable or rejected its configured credential. Verify the production private Blob-store connection before retrying.";
  }
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("econn")
  ) {
    return "The release upload could not reach Savage Library. Check the network connection and retry the same validated archive once.";
  }
  if (normalized.includes("failed to retrieve the client token")) {
    return "Vercel could not start the direct Blob upload even though the CLI preflight passed. Check the production deployment logs and retry the same validated archive once.";
  }

  return message || "The release upload failed for an unknown reason.";
}

export function isPublisherToken(value) {
  return typeof value === "string" && /^slp_[0-9a-f]{64}$/i.test(value);
}

export function isFinalizedRelease(value) {
  return Boolean(value && typeof value === "object" && value.checksum);
}
