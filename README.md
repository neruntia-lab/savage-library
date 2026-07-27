# Savage Library

Savage Library is a production-oriented digital library for authorized tabletop
role-playing game resources: Foundry VTT modules, classes, subclasses, PDFs,
manifests, installation notes, and release history.

The public experience is intentionally compact: search first, URL-backed
filters, concise resource cards, and details only when a field has content.

## Stack

- TypeScript, React, and Next.js-compatible routing through Vinext
- Cloudflare Workers runtime
- Cloudflare D1 relational database with Drizzle ORM
- Cloudflare R2 object storage
- Dispatch-owned Sign in with ChatGPT for optional account identity
- Server-side email allowlist for administrator authorization

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for route, boundary, and data
model details.

## Requirements

- Node.js 22.13 or newer
- npm
- A Sites-capable Codex workspace for managed deployment

## Local setup

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The D1 schema and example catalog data initialize on the first request. The
public site remains usable with built-in seed data if a local storage binding is
temporarily unavailable.

On Windows PowerShell, set the admin list in `.env.local`:

```dotenv
ADMIN_EMAILS=owner@example.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Account and admin identity headers are supplied by the hosted sign-in
dispatcher. Public catalog pages work without authentication.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_EMAILS` | Production admin use | Comma-separated, case-insensitive administrator allowlist |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical origin used by sitemap and metadata fallbacks |

Do not place secrets in source control. `.env*` files are ignored except for
the documented `.env.example`.

The logical storage bindings live in `.openai/hosting.json`:

- `DB`: D1 catalog, accounts, saves, downloads, and rate-limit counters
- `FILES`: R2 PDFs, module packages, images, and manifests

The hosting platform owns the physical databases, buckets, and deployment
wiring.

## Commands

```bash
npm run dev          # local development
npm run build        # production Worker build
npm test             # business-logic and validation tests
npm run test:flows   # launch the app and verify key public user flows
npm run test:build   # build followed by all automated tests
npm run lint         # ESLint
npm run db:generate  # generate a migration after schema changes
```

Whenever `db/schema.ts` changes, run `npm run db:generate`, inspect the new SQL
under `drizzle/`, and commit both the schema and migration.

## Content management

The `/admin` dashboard requires sign-in and an email listed in `ADMIN_EMAILS`.
It supports:

- create, edit, publish, unpublish, feature, and delete resources
- version and Foundry compatibility metadata
- dependencies and changelog entries
- validated PDF, ZIP, JSON, and image uploads
- categories, systems, authors, and tags
- per-resource and aggregate download counts

Uploads must match both the allowed extension and MIME type and cannot exceed
50 MB. Downloads are served through a rate-limited application route, so
restricted files can require identity and every successful transfer can be
recorded.

## Authentication and authorization

Public browsing does not require an account. `/account` and its mutation APIs
use dispatch-owned Sign in with ChatGPT. The dispatcher owns the sign-in,
callback, sign-out, cookie, and authentication rate-limiting flow.

Authentication does not grant admin access. Every admin page and API request
also checks the server-side email allowlist. Client controls are never treated
as authorization.

## Deployment

The default build targets Vercel's native Next.js runtime.

1. Import this repository into Vercel and select the `development` branch.
2. Keep the framework preset on **Next.js**, the root directory on the
   repository root, and the output directory on its framework default.
3. Set `NEXT_PUBLIC_SITE_URL` to the production origin and configure
   `ADMIN_EMAILS` only when the authenticated admin workflow is available.
4. Run `npm run test:build`, then deploy.
5. Verify `/`, `/library`, a resource detail route, `/sitemap.xml`, and
   `/robots.txt`.

The public catalog uses bundled seed data when no persistent database is
configured, so it remains available on a fresh Vercel project. Database-backed
accounts, admin writes, uploads, and download tracking require a compatible
database and object-storage adapter.

The legacy Cloudflare Worker build remains available as
`npm run build:cloudflare` for environments that provide the expected
Cloudflare bindings.

## Content policy

Only upload or distribute material the site owner is authorized to publish.
Every public resource should include author attribution, license information,
and a compatibility status. User-entered descriptions are stored and rendered
as plain text; arbitrary HTML is not accepted.
