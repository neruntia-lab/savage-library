# Production readiness audit

Audit date: 2026-08-11

## Release decision

**Not yet ready for the complete production launch.** The public catalog and
free Foundry distribution are operating, but production authentication and the
paid/complimentary access paths still have configuration and end-to-end release
gates that must be completed.

## Verified working

- `main` builds with Next.js 16.3.0 and passes TypeScript and ESLint.
- All 39 unit tests and 4 HTTP-flow tests pass.
- Drizzle migration integrity passes `drizzle-kit check`.
- `npm audit --omit=dev` reports zero known vulnerabilities.
- Home, library, resource, account, admin, and admin-login routes render at a
  375-pixel viewport without horizontal document overflow.
- Production home, library, robots, sitemap, and protected admin responses have
  the expected HTTP status.
- Production rejects anonymous admin and cron requests.
- All three published Foundry module manifests return JSON and their generated
  artifact downloads return HTTP 200.
- Savage Craft's downloaded ZIP contains one `savage-craft` root, the expected
  `module.json`, production updater metadata, and no publisher credentials,
  environment files, or nested ZIPs.
- Patreon reconciliation has populated members and review candidates in the
  production dashboard.

## Blocking release gates

1. **Correct the Production Auth.js origins in Vercel.** A live request to
   `/api/auth/providers` currently returns sign-in and callback URLs on the
   development deployment. Set both `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL`
   to `https://savage-library.vercel.app`. The application now also pins these
   values in code when `VERCEL_ENV=production`, but the environment must still
   be corrected and verified after deployment.
2. **Configure and verify SMTP.** The live Auth.js provider list does not include
   the email provider, proving that `EMAIL_SERVER` and/or `EMAIL_FROM` is absent
   or invalid. Complimentary members cannot sign in until a real one-time magic
   link is delivered and consumed successfully.
3. **Exercise a paid resource end to end.** Production currently has zero
   Patreon-protected resources. Create a temporary protected draft/release and
   verify denied anonymous access, denied non-entitled access, successful
   entitled Patreon access, successful complimentary access, audit recording,
   and destination secrecy. Remove or unpublish the test resource afterward.
4. **Review and approve the legal pages.** Draft privacy and terms pages now
   cover Auth.js identities, Patreon membership data, download audit records,
   email delivery, retention, deletion requests, and contact information. The
   site owner should obtain any necessary legal review, then use `/privacy` and
   `/terms` as the canonical Patreon client URLs.

## Required launch checks

- Run `npm run check:production` with the Vercel Production environment.
- Confirm Patreon lists both production callback URLs:
  - `https://savage-library.vercel.app/api/auth/callback/patreon`
  - `https://savage-library.vercel.app/api/account/link-patreon/callback`
- Deploy the current committed `main` state and confirm
  `/api/auth/providers` contains only production callback URLs and includes the
  email provider.
- In the Patreon admin panel, confirm **Creator connected**, **Webhook
  configured**, a recent successful sync, and a processed webhook delivery.
- Trigger the cron endpoint through Vercel and confirm its next run succeeds.
- Confirm Neon backups or point-in-time recovery and document a restore drill.
- Confirm Vercel Blob retention and orphan cleanup procedures for replaced and
  deleted files.
- Resolve review warnings on Patreon import candidates. Posts intended to
  create downloadable catalog content need structured labels and explicit
  HTTPS links, including `[PAID]` labels for protected destinations.

## Recommended follow-up improvements

- Add authenticated HTTP-flow coverage for administrator login throttling,
  resource mutations, taxonomy mutations, uploads, grants, Patreon linking,
  release publication/rollback, and protected downloads.
- Add external error reporting and alerts for failed deployments, cron runs,
  webhook processing, SMTP delivery, Patreon refresh failures, and Blob errors.
- Add a lightweight production health endpoint that checks database access and
  reports integration state without exposing secrets.
- Define retention periods for download audits, webhook deliveries, expired
  verification tokens, and rate-limit rows, then add scheduled cleanup.
- Add a content-security policy after verifying the directives required by
  Next.js, Auth.js, Patreon, and Vercel Blob.

## Changes made during this audit

- Updated vulnerable production dependencies and removed all npm audit findings.
- Added global anti-framing, MIME-sniffing, referrer, and browser-permission
  security headers.
- Added administrator credential-attempt throttling.
- Added a production-origin safeguard for Auth.js, complimentary magic links,
  and Patreon webhook registration.
- Added a reusable production-environment validator.
- Removed automatic example-data seeding from Vercel production builds.
- Made the sitemap include every catalog page rather than only the first 48
  resources.
- Added creator, webhook, synchronization, and delivery health information to
  the Patreon dashboard.
- Replaced obsolete Cloudflare/R2 documentation with the deployed
  Vercel/Neon/Blob architecture and corrected the release instructions.
- Added public privacy and terms pages, footer links, sitemap entries, and HTTP
  coverage for the legal disclosures.
