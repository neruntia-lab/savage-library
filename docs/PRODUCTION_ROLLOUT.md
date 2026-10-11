# Production rollout readiness

## Target and safeguards

- Release candidate: `development`, starting from `b31b353`.
- Production rollback commit: `58495638ced9b490787d1f269137acf52fe7f79e`.
- Production origin: `https://savage-library.vercel.app`.
- Retain production data and Blob stores; do not replace them with Preview data.
- Keep new member Patreon connections disabled. Creator integration remains enabled.
- Do not publish module releases, reset counters, or delete content for rollout testing.
- Preserve untracked attachments and shareable files.

## Readiness changes

- Node engine restricted to `22.x`, matching the quality workflow's Node 22.
- Quality workflow runs on pushes to both `development` and `main`.

## Verified locally

- ESLint and TypeScript passed.
- Unit/database suite: 108 tests passed, including isolated PostgreSQL Wiki
  migrations, private/idempotent starter drafts, resource publication transactions,
  download tracking, artwork rollback, publisher validation, and access boundaries.
- Production build passed; isolated HTTP suite: 18 tests passed. Build and both
  test suites also passed under Node `22.23.3`, matching the pinned production major.
- Production dependency audit: zero reported vulnerabilities.
- Read-only browser checks passed for public/admin page templates, wizard steps,
  editors/previews, error states, menus, and logout at 390, 820, and 1440px.
- Homepage checks passed at 320, 390, 620, 820, 930, 960, and 1440px.
- Wiki, resource-sidebar, and larger-catalog failure/retry/pagination checks passed.
- Local previews use fixture data with database and service writes disabled.
- Representative browser screenshots were visually reviewed. This does not
  replace physical Safari/Firefox, screen-reader, or real service testing.

## Pre-rollout live observations

- Production homepage still shows maintenance; `/api/health` returns 200.
- Savage Craft manifest returns JSON, version `1.4.1`.
- Savage Sounds manifest returns JSON, version `3.13.2`.
- Both manifests and their download origins point to production.
- No download request or production database mutation was made during these checks.

## Required gates before pushing main

1. Authenticate Vercel access. Local CLI was logged out during preparation.
2. Verify production database identity and Preview separation, production-only
   canonical origins, auth/admin secrets, SMTP, public/private Blob access,
   Patreon creator credentials, webhook configuration, cron authentication,
   and paused member-connection flag without exposing secret values.
3. Create and verify a production database backup/recovery point. Record the
   existing production deployment ID for immediate Vercel rollback.
4. Verify actual isolated-service upload/persistence, wizard, authentication,
   publisher, and download behavior; fixture checks alone do not prove these.
5. Review production migration history. Apply only pending migrations after
   backup; do not reset or reseed production. `0011` adds Wiki storage and `0012`
   adds private module starters and triggers without publishing or deleting resources.
6. Commit readiness changes on development, then merge non-destructively into main.
   Explicitly remove `proxy.ts` and `app/maintenance/page.tsx` from the merge:
   they were added only on main and would otherwise survive the merge.
7. Verify the final merge, tests, and removal of maintenance routing before pushing.
8. Inspect the Vercel deployment before production promotion if staging controls
   allow it; otherwise run immediate live smoke checks after automatic promotion.

## Live acceptance and recovery

Verify real published catalog content, Wiki/legal pages, admin login/logout,
artwork, hidden protected destinations, existing manifests and ZIP delivery,
creator sync health, and production-domain URLs. New upload tests must remain
unpublished and must not rotate existing publisher tokens or alter live releases.
If a critical check fails, restore the recorded maintenance deployment.
Keep additive Wiki migrations unless a separately reviewed data recovery is needed.
Do not report the site production-ready while a required gate remains blocked.
