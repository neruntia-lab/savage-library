# Production Web Analytics

Savage Library uses `@vercel/analytics/next` for aggregate public-page traffic.
The root layout mounts `PublicAnalytics` only when Vercel's `VERCEL_ENV` is
`production`; no new credentials or environment variables are required.

`lib/analytics.ts` permits known public routes on the canonical production
hostname, drops private/unknown routes and draft previews, rejects custom
events, and removes query strings and fragments from page-view URLs. Update
the public-route matcher and its tests when adding a new public page type.
The client does not initialize analytics on private or draft-preview pages;
the event filter also guards transitions after a public page initialized it.

Analytics does not replace or modify download counters, entitlements, or audit
records. It does not add account identities or membership properties. It is
not enabled for local development or Preview deployments.

Privacy disclosures are shared by `/privacy` and `/legal`, effective October
19, 2026. Terms remain effective August 11, 2026: traffic measurement adds no
new licensing, billing, or account obligations. Analytics is cookie-free;
existing essential authentication cookies remain unchanged. The documented
24-hour visitor-session period is not a retention promise for aggregate reports.

Provider references:
- https://vercel.com/docs/analytics/quickstart
- https://vercel.com/docs/analytics/privacy-policy
- https://vercel.com/docs/analytics/redacting-sensitive-data

Verify production using the built-in browser: visit public pages using the
site navigation, then check the project's Vercel Analytics dashboard. Content
blockers can prevent collection. Do not enable paid plans or extra tracking to
make verification pass.

Installation reported nine advisories in existing ESLint/Drizzle development
tooling (four moderate, five high), none in `@vercel/analytics`. No unrelated
dependency upgrades were applied. The local runtime reports Node 24 while the
project and production target Node 22; local checks must not be described as a
Node 22 runtime certification.
