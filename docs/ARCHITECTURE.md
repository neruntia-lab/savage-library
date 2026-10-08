# Savage Library architecture

## Wiki and public navigation

Desktop, mobile, and footer navigation share Library (`/`), Wiki (`/wiki`), and Terms & Privacy (`/legal`). Account and Patreon routes remain operational but public access links are hidden. Catalog/category and individual legal URLs remain available directly.

Wiki rows keep independent working and published bilingual JSON snapshots, module associations, and a revision counter. Draft saves never modify the public snapshot. Publication promotes all metadata in one atomic update; stale revisions return 409. Public queries select only published columns and exclude unfinished translations. Resource deletion clears associations. Admin editing and unsaved preview rendering require administrator sessions. Preview and public guides share their presentation and sanitized Markdown renderer.

Apply `0011_wiki_guides` and `0012_module_wiki_starters` to a separate development database before hosted persistence testing. The latter backfills uncovered modules and installs an atomic resource insert/type-change trigger, covering dashboard, wizard, CLI, Patreon and seed writes. Row locking and unique nullable starter provenance prevent duplicate automatic drafts, including after manual unlinking. Existing working/published associations suppress new starters. Titles are copied once in the resource default language; admin content is never overwritten. Resource deletion clears references without deleting guide history.

Public Wiki cards reuse library card styling in a three/two/one-column responsive grid, exposing only published guide snapshots and artwork from published associated resources. Private Blob URLs are rejected before serialization. Local preview uses labeled public samples and private starter samples, and rejects Wiki writes; hosted environments never serve these fixtures. Dedicated Wiki image uploads and community contributions are not included. In-memory PostgreSQL tests exercise migration, backfill, retries, collision handling and rollback without any production connection.

Vercel Preview builds refuse automatic migrations unless `SAVAGE_LIBRARY_PREVIEW_DATABASE_CONFIRMED=1` is set in Preview. Set it only after confirming `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (if used) target a separate development database. Production builds are unchanged. This guard intentionally blocks unconfirmed preview deployments rather than risking production data writes.

## Download counters

Resource download and popularity counters measure authorized file-delivery GET requests, not unique users or completed transfers. Website downloads and Foundry ZIP delivery validate access, generate a signed HTTPS Blob URL, then atomically insert an audit event and increment both counters before issuing a non-cacheable redirect. Storage or tracking failures do not redirect or leave partial counts. HEAD requests, manifest requests and page views do not count. Protected remote links retain their separate access counters.

New seeds and read-only catalog samples start at zero. Cards, admin totals and sorting read persisted resource counters; historical audit rows never repopulate a reset counter. A refresh shows subsequent requests without requiring a real-time dashboard.

The administrative reset is operational, not a migration or deployment hook. Run a dry run using an ignored environment file containing the **confirmed target's** database URL:

```sh
npm run counters:reset -- --environment development --env-file .env.development.reset
npm run counters:reset -- --environment development --env-file .env.development.reset --apply --confirm <fingerprint-from-dry-run>
```

Repeat for `production` with its own confirmed environment file. Do not commit credentials or backups. The script does not load `.env.local` or inherit connection variables. It prints only a database fingerprint, totals and a backup path. If production and development resolve to the same database, report that configuration issue rather than pretending they are separate targets.

Each applied reset locks affected tables, saves and verifies exact pre-reset values under ignored `work/counter-backups/`, zeros only resource download/popularity and protected-link access counts, and records `download-counter-reset-v1` in synchronization state in the same transaction. Historical audit rows and other data are preserved. Repeating a completed operation skips resetting, preserving downloads recorded since it ran. Failure rolls back the database changes; retain any backup produced by a failed attempt for inspection.

Keep backups outside the repository as needed for recovery. A counter restoration must account for post-reset downloads rather than blindly overwriting the current values with the backup. No public reset endpoint or automatic counter reset is provided.

## Runtime

Savage Library is a Next.js 16 and React 19 application deployed on Vercel.

- Server components render public catalog and account pages.
- Neon Postgres stores catalog, authentication, Patreon, audit, and release data.
- Separate Vercel Blob stores hold public artwork and private downloadable files.
- Auth.js provides administrator credentials, Patreon OAuth, and email magic links.
- Patreon webhooks and a daily authenticated Vercel cron keep membership and post
  import data synchronized.

## Route structure

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Home and featured resources | Public |
| `/library` | URL-backed search, filters, sort, and pagination | Public |
| `/resources/[slug]` | Catalog detail, compatibility, files, and releases | Public |
| `/categories/[slug]` | Resource-category catalog | Public |
| `/account` | Identity, Patreon linking, and effective access | Signed in |
| `/admin` | Resource, taxonomy, appearance, membership, and Patreon management | Admin |
| `/api/resources` | Public catalog query and protected resource creation | Mixed |
| `/api/uploads` | Validated direct Vercel Blob upload authorization | Admin |
| `/api/downloads/[fileId]` | Entitlement check, audit, and signed private download redirect | Mixed |
| `/api/foundry/modules/[slug]/module.json` | Stable generated manifest for free modules | Public |
| `/api/patreon/webhook` | Signed Patreon event receiver | Patreon signature |
| `/api/cron/patreon` | Daily reconciliation | Cron bearer token |
| `/api/health` | Non-sensitive database availability probe | Public |

## Boundaries

- `app/` contains routes and server-rendered page composition.
- `components/` contains client and server UI components.
- `components/resources/ResourcePresentation` is shared by authorized previews and published resource pages.
- `components/admin/WizardSteps` and the editor field components keep rendering separate from workflow state.
- `lib/client/` owns same-origin JSON error handling, resource form payloads, and shared direct-upload/finalization workflows.
- `useResourceUploads` owns per-slot concurrency and temporary artwork URL cleanup.
- `lib/domain/` owns shared resource and compatibility types.
- `lib/validation/` validates resource, taxonomy, artwork, and upload input.
- `lib/repositories/` owns database and Blob persistence.
- `lib/services/` coordinates authorization, entitlements, synchronization,
  sanitization, rate limiting, and application workflows.
- `db/schema.ts` defines the relational schema; `drizzle/` contains forward-only
  production migrations.

Resource persistence is split into a read facade, write repository, and explicit
example seeding. The CLI delegates secret-free archive creation to
`scripts/publisher-package.mjs`. Theme imports under `app/styles/` retain a
predictable cascade, with shared reference tokens and ornamental components.

`npm run preview:local` launches a loopback-only fixture environment. Its
database/storage guards prevent accidental production writes and its local
fixtures are unavailable on Vercel. See `DEVELOPMENT_AUDIT.md` for limitations.

Public descriptions are sanitized Markdown. Private Blob destinations and
Patreon-protected link destinations are resolved only by authorized server
routes. Free Foundry modules use a stable production manifest generated from
the active immutable release.

The daily reconciliation also removes expired rate-limit records and one-time
verification tokens. Successfully processed webhook delivery records are kept
for 90 days; failed or pending deliveries remain available for diagnosis.
## Homepage catalog

The homepage uses the shared published-resource catalog with the internal
`paginate: false` policy. Banner search and the filters below it submit GET
requests to `/#library`, preserving search, source type, game system, and sorting.
The compact controls use client-side navigation for immediate updates without
pagination parameters. Tags are informational; retired public filter parameters
are ignored. Sorting is outside the two-filter fieldset. `/library`,
category routes, and `/api/resources` retain their paginated contracts; URL
parameters cannot enable the internal unbounded listing policy.
