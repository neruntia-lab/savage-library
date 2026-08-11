# Deployment and release checklist

## Before release

- `NEXT_PUBLIC_SITE_URL` and `NEXTAUTH_URL` both equal `https://savage-library.vercel.app` in Production.
- `npm run check:production` passes with the Production environment values.
- New schema migrations have been generated and inspected.
- `npm run test:build` passes.
- Resource attribution and license fields are complete.
- Uploaded files have the expected MIME type, extension, and size.
- SMTP sender configuration has been verified with a real magic-link login.
- The Patreon creator account is connected and webhook health is shown as healthy.
- `CRON_SECRET` and `PATREON_TOKEN_ENCRYPTION_KEY` are unique production secrets.

## Smoke test

1. Open the home page and search for a known resource.
2. Apply filters, change sort order, and reload the copied URL.
3. Open a resource, copy its manifest, and check any compatibility warning.
4. Sign in, save a resource, and confirm it appears under `/account`.
5. Sign in as an administrator and create a draft.
6. Add a version, dependency, changelog entry, and valid small upload.
7. Publish the draft, download its file, and confirm the download count changes.
8. Confirm `/sitemap.xml`, `/robots.txt`, and the social preview metadata.
9. Confirm `/api/health` returns HTTP 200 and `{ "status": "ok" }`.

## Rollback

Redeploy a previously healthy Vercel deployment or revert to a known-good Git
commit. Do not reverse a production migration by deleting tables or columns.
Use a forward migration that restores compatibility, then deploy the matching
application version.

Vercel Blob objects are not deleted automatically during a normal application
rollback. Keep file metadata and Blob retention aligned before manual cleanup.
