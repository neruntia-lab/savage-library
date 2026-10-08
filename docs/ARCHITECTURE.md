# Savage Library architecture

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
