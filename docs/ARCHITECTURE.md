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
- `lib/domain/` owns shared resource and compatibility types.
- `lib/validation/` validates resource, taxonomy, artwork, and upload input.
- `lib/repositories/` owns database and Blob persistence.
- `lib/services/` coordinates authorization, entitlements, synchronization,
  sanitization, rate limiting, and application workflows.
- `db/schema.ts` defines the relational schema; `drizzle/` contains forward-only
  production migrations.

Public descriptions are sanitized Markdown. Private Blob destinations and
Patreon-protected link destinations are resolved only by authorized server
routes. Free Foundry modules use a stable production manifest generated from
the active immutable release.

The daily reconciliation also removes expired rate-limit records and one-time
verification tokens. Successfully processed webhook delivery records are kept
for 90 days; failed or pending deliveries remain available for diagnosis.
