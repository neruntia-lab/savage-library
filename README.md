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
| `PATREON_CREATOR_REFRESH_TOKEN` | Creator refresh token used to renew campaign access |
| `PATREON_TOKEN_ENCRYPTION_KEY` | Secret used to encrypt stored creator OAuth and webhook credentials |
| `PATREON_WEBHOOK_SECRET` | Optional bootstrap webhook secret when no stored creator connection exists |
| `EMAIL_SERVER` | SMTP connection URL used for passwordless member sign-in |
| `EMAIL_FROM` | Verified sender used for Savage Library sign-in links |
| `CRON_SECRET` | Bearer secret protecting the daily Patreon reconciliation endpoint |
| `PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN` | Public Blob store for covers and thumbnails |
| `PRIVATE_CONTENT_BLOB_READ_WRITE_TOKEN` | Private Blob store for downloadable content |

Register this callback URL in the Patreon developer portal:

```text
https://YOUR-DOMAIN/api/auth/callback/patreon
```

Also register the explicit account-linking callback:

```text
https://YOUR-DOMAIN/api/account/link-patreon/callback
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
- Patreon member and post synchronization with signed webhooks
- complimentary tier grants with optional expiration and audit history
- passwordless email access for complimentary members

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

Administrators may grant selected tier-equivalent access to a verified website
email account. An active Patreon membership permanently replaces an existing
complimentary grant. Patreon post text is mirrored under `/news`; links prefixed
with `[PAID]` are removed from public HTML and resolved only after an entitlement
check.

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

## Foundry module publishing

Savage Library can publish free Foundry modules without GitHub Releases. In the
resource editor, open **Module releases**, upload a ZIP, review the detected
manifest and compatibility, then publish the draft. Each module keeps a stable
manifest at `/api/foundry/modules/{resource-slug}/module.json`.

For command-line uploads, rotate the module's CLI token in that panel and link
the module directory once:

```powershell
npm run publisher -- link --site https://your-site.example --resource RESOURCE_ID --token TOKEN
npm run publisher -- validate
npm run publisher -- release
```

The local `.savage-library.json` contains the publisher credential and is
ignored by Git. Add one filename or directory per line to `.savageignore` to
exclude development files from the generated ZIP. CLI uploads always create a
draft and never change the active Foundry release.

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
