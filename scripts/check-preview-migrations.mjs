// Run before Vercel migrations. Preview credentials may otherwise inherit the
// production database connection; approval is scoped to a separate preview DB.
if (
  process.env.VERCEL_ENV === "preview" &&
  process.env.SAVAGE_LIBRARY_PREVIEW_DATABASE_CONFIRMED !== "1"
) {
  console.error(
    "Preview migrations blocked. Configure a separate development DATABASE_URL (and DATABASE_URL_UNPOOLED, if used), then set SAVAGE_LIBRARY_PREVIEW_DATABASE_CONFIRMED=1 in Preview only. Never approve a production database for preview migrations.",
  );
  process.exitCode = 1;
}
