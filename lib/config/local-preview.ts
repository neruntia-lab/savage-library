/** Explicit local-only mode. Hosted Vercel deployments cannot enable sample fixtures. */
export function isLocalPreview(): boolean {
  return (
    process.env.SAVAGE_LIBRARY_LOCAL_PREVIEW === "1" && !process.env.VERCEL
  );
}
