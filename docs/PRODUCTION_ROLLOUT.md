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
- Vercel production builds validate required configuration before migrations.
- Email sign-in and complimentary invitations respect `EMAIL_SIGN_IN_ENABLED`.
  Production is explicitly paused; missing SMTP also hides unavailable email UI.
  Admin authentication and existing member sessions are preserved.

## Verified locally

- ESLint and TypeScript passed.
- Unit/database suite: 110 tests, including isolated PostgreSQL Wiki
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
- Vercel CLI is authenticated. Recorded rollback deployment:
  `dpl_CdLZDfFym2dcEBRZbRVtmiX9LDyF`.
- Production database store: `store_lL1dF9SfsQH1N1sH`; Preview database store:
  `store_igoKj6R2cT2ZzXwn`. Vercel metadata confirms they are separate.
- Required non-email production variable names are present. SMTP is intentionally
  absent and email sign-in is paused; secret values have not been exported.
- Database credentials are `sensitive`/non-exportable through Vercel's API.
  No production credential file was created or needed for provider-side recovery.
- Authenticated Vercel-to-Neon console access was verified on October 11, 2026.
  Created a non-expiring manual snapshot of production branch
  `br-square-wind-aw5q8v7i` in project `patient-wave-12674613` at
  `2026-10-11 06:12:57 UTC`. Snapshot label:
  `Pre-rollout main 5849563 — 2026-10-11`.
- Read-only production migration ledger contains 11 entries through `0010`
  (`created_at=1787883665533`); only `0011` and `0012` remain pending.
- Set Vercel project Node runtime to `22.x` and verified the saved setting.
- Set `NEXTAUTH_URL` to the production origin. With explicit user confirmation,
  replaced the legacy Secret `NEXT_PUBLIC_SITE_URL` with a Config variable set
  to the production origin, preserving Production and Preview scopes. Vercel
  rejects editing public-prefix variables as Secrets. No authentication or
  database credentials were rotated or removed.
- These environment/runtime changes require a new deployment. Production still
  runs the recorded maintenance deployment; no production migration was applied.
- Preview and production administrator sessions were verified on October 11.
- Production creator health reports connected, webhook configured, and successful
  synchronization on October 10. No synchronization or membership mutation was
  triggered for this check.
- Live Preview workflow verification created only development taxonomy defaults
  and an unpublished macro draft `27d65e49-1445-4809-a8f1-51a5fb56388e`
  (`rollout-verification-unpublished-test`). Wizard steps persisted through review
  and Save as draft opened the complete editor. Required-file checks passed.
- Private macro upload succeeded. Icon, cover, and thumbnail uploads succeeded;
  artwork loaded from the public Blob store and all four saved files survived
  reloading the editor. Upload percentage and saving/saved feedback were observed.
  Draft preview rendered the persisted artwork and Markdown bullets correctly.
- Test content remains unpublished in Preview. No production resource, release,
  counter, artwork, token, or publication state was changed by these workflow tests.
- With separately confirmed production test scope, CLI-only packaging, validation,
  catalog creation, private ZIP upload, and draft persistence succeeded for
  `savage-rollout-verification-20261011` version `1.0.0`, resource
  `90891f18-dabb-4fa2-994d-1f10c599cf7b`. SHA-256:
  `57ec1f9ce52e736380cf46f577e605ff6a4d204fe7dce627ce6b905622926aff`.
  The approximately 0.7 KB no-op test archive remains an unpublished, validated
  draft; its public manifest returns 404. No publication scope was granted.
- Revoked the named temporary administrator CLI credential and cleared only the
  new test resource's publisher-token hash. The revoked administrator credential
  was rejected by the CLI with an explicit authentication error. Removed both
  local temporary credential files; existing publisher credentials remain intact.
- Existing production manifests still return 200: Savage Craft `1.4.1` and
  Savage Sounds `3.13.2`. No existing resource or module release was modified.
- Hosted Preview logout confirmation ended the administrator session. A fresh
  `/admin` visit redirected to `/admin/login`; production's separate session
  was preserved. Preview logout returns to the configured canonical origin.
- Production merge resolves maintenance-era stylesheet/HTTP-test conflicts in
  favor of the verified development implementation and removes the main-only
  maintenance proxy/page. Explicit Vercel upload exclusions protect local
  attachments, shareable files, scratch output, and publisher secrets.
- Pre-migration production baseline read directly from Neon: 15 resources,
  7 published resources, and 4,690 persisted download requests. Counts are not
  reset by this rollout; legitimate subsequent download requests may increase them.
- Vercel dry-run selected 360 deployment files with no local attachment, share,
  scratch, or `.env.local` paths. The merged Node 22 build, lint, TypeScript,
  and 110 unit/database tests passed; the initial sandbox-only SWC path error
  was resolved by running the build with normal Windows permissions.

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

### October 11 rollout

- Merge commit `5636221` has both maintenance `main` and verified `development`
  parents. Staged production deployment `dpl_3p8T9n953AukAdNg1BdVMEDVnuP8`
  passed production configuration, migrations, compilation, and TypeScript before
  domain promotion. The maintenance deployment remains available for rollback.
- Production migration ledger now has 13 entries. Baseline resource/publication
  counts and 4,690 download requests were preserved. The 11 generated Wiki
  starters are private drafts; no guides were published during migration.
- Pushed the merge to `main` and promoted the checked deployment. Live homepage,
  all seven published resource pages, Wiki, legal, account, health, and catalog
  checks passed. `/dev/preview`, retired `/news`, and the unpublished test module
  manifest return 404. Public payloads expose no private Blob destinations.
- Existing Craft `1.4.1` and Sounds `3.13.2` manifests remain canonical production
  URLs. One Craft ZIP request returned a valid 68,267-byte archive with the correct
  package root, module ID, and version. The dashboard counter increased to 4,691.
- Existing production administrator session survived the rollout. Persisted
  public artwork loaded successfully. Member Patreon and email connections remain
  paused; creator integration is retained.
- Live admin verification exposed an inner-join defect hiding resources with only
  draft releases. Changed the admin-only list to a left join, preserving its API
  contract and publication boundaries. An isolated PostgreSQL regression verifies
  initial CLI drafts remain visible with their pending-release count. Full lint,
  TypeScript, build, 110 unit/database tests, and 18 HTTP flows passed again.
- Provider secrets were never downloaded. Physical Safari/Firefox, assistive
  technology, and an actual Foundry application installation were not exercised;
  installation protocol, ZIP contents, responsive Chromium checks, and automated
  authorization/transaction regressions were verified instead.

Verify real published catalog content, Wiki/legal pages, admin login/logout,
artwork, hidden protected destinations, existing manifests and ZIP delivery,
creator sync health, and production-domain URLs. New upload tests must remain
unpublished and must not rotate existing publisher tokens or alter live releases.
If a critical check fails, restore the recorded maintenance deployment.
Keep additive Wiki migrations unless a separately reviewed data recovery is needed.
Do not report the site production-ready while a required gate remains blocked.
