export function publisherUploadError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (
    normalized.includes("publisher token rejected") ||
    normalized.includes("401") ||
    normalized.includes("unauthorized")
  ) {
    return "Publisher authentication was rejected. Rotate the module publisher token in Savage Library, relink this module, and retry once.";
  }
  if (normalized.includes("403") || normalized.includes("forbidden")) {
    return "Publisher access was forbidden. Confirm the module is linked to the correct Savage Library resource, then rotate and relink its publisher token.";
  }
  if (
    normalized.includes("private module storage is unavailable") ||
    normalized.includes("503") ||
    normalized.includes("service unavailable")
  ) {
    return "Savage Library private module storage is unavailable. Verify the production private Blob-store connection before retrying.";
  }
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("econn")
  ) {
    return "The release upload could not reach Savage Library. Check the network connection and retry the same validated archive once.";
  }

  return message || "The release upload failed for an unknown reason.";
}
