# Savage Library

Savage Library is a bilingual digital library for Foundry VTT modules, PDFs,
classes, subclasses, manifests, installation notes, and release history.

The public catalog is optimized for discovery. The protected administration
workspace lets a small trusted team create drafts, maintain English and Spanish
translations, upload release files, synchronize Patreon tiers, preview entries,
and publish without editing source files.

## Production stack

- Next.js 16, React 19, and TypeScript
- Neon Postgres with Drizzle ORM
- Vercel Blob with separate public-media and private-content stores
- Auth.js sessions
- Patreon API v2 OAuth and live membership entitlement checks
- Vercel deployments, with `main` for production and `development` for preview

## Local setup

Requirements:

- Node.js 22.13 or newer
- npm
- A Neon database
- A Patreon API v2 OAuth client
- Public and private Vercel Blob stores

Install dependencies and create local environment values:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Generate a secure authentication secret and a strong shared administrator
password. Set the password temporarily in `ADMIN_PASSWORD_TO_HASH`, run the hash
command, and copy only its output into `ADMIN_PASSWORD_HASH`.

```powershell
npm run auth:hash-admin-password
```

Apply the schema and optionally import the five bundled entries as draft
examples:

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. Public pages continue to use bundled read-only
examples when `DATABASE_URL` is absent, but administration and uploads require
the configured services.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical public origin |
| `NEXTAUTH_URL` | Auth.js callback origin |
| `AUTH_SECRET` | Session encryption/signing secret |
| `ADMIN_PASSWORD_HASH` | Scrypt hash for the shared administrator password |
| `DATABASE_URL` | Neon pooled Postgres connection string |
| `PATREON_CLIENT_ID` | Patreon API v2 OAuth client ID |
| `PATREON_CLIENT_SECRET` | Patreon OAuth client secret |
| `PATREON_CAMPAIGN_ID` | Savage Library campaign ID |
| `PATREON_CAMPAIGN_URL` | Public membership page |
| `PATREON_CREATOR_ACCESS_TOKEN` | Creator token used to synchronize campaign tiers |
| `PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN` | Public Blob store for covers and thumbnails |
| `PRIVATE_CONTENT_BLOB_READ_WRITE_TOKEN` | Private Blob store for downloadable content |

Register this callback URL in the Patreon developer portal:

```text
https://YOUR-DOMAIN/api/auth/callback/patreon
```

Use the stable `development` branch URL for preview credentials and the
production domain for production credentials.

## Administration

Visit `/admin/login` and enter the shared administrator password.

The dashboard supports:

- searchable drafts and published resources
- English and Spanish content with independent publication states
- public or Patreon-tier-protected downloads per resource
- version and Foundry compatibility history
- repeatable dependency fields and searchable tag choices
- direct cover, thumbnail, ZIP, PDF, and JSON uploads up to 250 MB
- background autosave, explicit save, draft preview, and publication
- Patreon tier synchronization

English and Spanish files are attached independently to the current release.
Changing the current version creates a new release while older releases remain
in the database.

## Patreon download authorization

Resource descriptions and release information remain public. For a protected
download, the application:

1. requires Patreon OAuth;
2. requests the visitor's current membership and entitled tiers from Patreon;
3. verifies a selected tier for the Savage Library campaign;
4. records the download; and
5. returns a short-lived signed URL for the private Blob.

Authorization fails closed if Patreon cannot verify the membership. Private Blob
URLs are never exposed through catalog responses.

## Commands

```powershell
npm run dev
npm run build
npm run lint
npm test
npm run test:flows
npm run test:build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run auth:hash-admin-password
```

After changing `db/schema.ts`, generate and inspect a new migration under
`drizzle/`.

## Deployment

1. Connect Neon and both Blob stores to the Vercel project.
2. Add environment values separately for Preview and Production.
3. Push to `development` and verify the Vercel preview. Vercel applies pending
   migrations and idempotently creates the bundled draft examples before each
   build, using `DATABASE_URL_UNPOOLED` when available.
4. Test admin login, Patreon tier synchronization, public downloads, protected
   downloads, translations, uploads, preview, and publishing.
5. Promote to `main` only after the preview is approved.

`Logo`, `Macros`, and `Mods` are intentionally excluded from source control.
Only the optimized logo asset under `public/` is deployed.

## Content policy

Only publish material Savage Library is authorized to distribute. Descriptions
and instructions are stored as plain text; arbitrary HTML is not accepted.
