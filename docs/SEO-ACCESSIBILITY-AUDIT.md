# SEO, accessibility, and performance audit

## Implementation

- Shared `lib/seo.ts` supplies canonical HTTPS URLs, complete social metadata, safe JSON-LD serialization, and the static public-page registry.
- Sitemap and llms.txt read published catalog/Wiki records on each request. Drafts, auth routes, previews, legacy News, and duplicate library/legal pages are excluded.
- Production is indexable; local/Preview environments have noindex and crawl restrictions. Private account/admin routes remain excluded. Robots is not an authorization boundary.
- Home, categories, resources, Wiki, and legal pages have topic-specific metadata. Filter parameters canonicalize to base pages. Published Spanish resource/guide variants have language alternates.
- `/library` retains functionality and canonicalizes to `/`; standalone privacy/terms pages canonicalize to the combined policy page. No permanent content URLs were renamed.
- Organization/WebSite and resource/guide structured data use visible content only, without prices, member data, or download destinations.
- Markdown headings cannot introduce a second H1; heading jumps are clamped. Legal sections nest under their section heading. Catalog/Wiki card heading levels follow their context without changing styling.
- Existing responsive Next Image delivery is retained, AVIF/WebP enabled, and the above-fold resource image uses preload and explicit responsive sizing. Decorative fallback artwork has empty alt text.
- The branded social image is resized to 1200×630 JPEG: 115,902 bytes instead of the 2,243,753-byte PNG (approximately 95% smaller). The original remains intact.
- Authentication, entitlement checks, private Blob storage, and atomic download tracking are unchanged.

## Search Console

Set `GOOGLE_SITE_VERIFICATION` to the HTML verification token supplied by Google (not the full meta tag), redeploy, then verify the URL-prefix property `https://savage-library.vercel.app/`.
Submit `https://savage-library.vercel.app/sitemap.xml`. DNS verification is also available directly through the domain provider for a custom domain. No verification is claimed without account access.

## Reproducible checks

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:flows`.
Run `node scripts/audit-public-seo.mjs <origin>` against the isolated preview or production after deployment. It crawls public HTML only, skips counted downloads/auth actions, and reports blocked external HEAD requests as inconclusive rather than broken.

## Changed-file inventory

- Discovery/helpers: `lib/seo.ts`, `lib/repositories/sitemap-repository.ts`, `app/sitemap.ts`, `app/robots.ts`, `app/llms.txt/route.ts`.
- Metadata/rendering: `app/layout.tsx`, `app/page.tsx`, `app/account/page.tsx`, `app/library/page.tsx`, `app/categories/[slug]/page.tsx`, `app/resources/[slug]/page.tsx`, `app/wiki/page.tsx`, `app/wiki/[slug]/page.tsx`, `app/legal/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`.
- Shared presentation: `components/legal/PrivacyContent.tsx`, `components/legal/TermsContent.tsx`, `components/resources/ResourceCard.tsx`, `components/resources/ResourceGrid.tsx`, `components/resources/ResourcePresentation.tsx`, `components/wiki/WikiCard.tsx`, `lib/services/resource-markdown.ts`, `app/styles/catalog.css`, `app/styles/foundation.css`.
- Build compatibility: `app/api/patreon/webhook/route.ts`, `lib/services/webhook-delivery.ts`, `next.config.ts`, `package.json`.
- Asset/tests/audit: `public/og-social.jpg`, `tests/seo.test.ts`, `tests/http-flows.test.ts`, `tests/webhook.test.ts`, `scripts/audit-public-seo.mjs`, this report.

## Verification status

Lint and TypeScript pass. All 118 unit/database tests and 19 isolated HTTP-flow tests pass. A complete production webpack build passes. Google ownership verification/submission, real-user Core Web Vitals, authenticated responsive visual review, and post-deployment verification remain separate checks; none is claimed complete from these automated results alone.

## Limits

The initial production crawl checked 14 public pages: every page lacked a canonical tag. Public links checked returned no errors; the external GitHub profile returned HTTP 200. Production HTTP permanently redirects to HTTPS with status 308, and robots/sitemap respond 200. These checks do not exercise protected downloads.
The default local Turbopack build failed while starting its CSS worker; webpack compilation exposed an existing unsupported webhook route export. The pure helper was moved to a service and tests updated without behavior changes.
Production build scripts now explicitly use the supported webpack bundler, which compiled and passed all HTTP flows; runtime behavior and development tooling are unchanged.
Browser tooling reported no available browsers in this session, so visual responsive inspection and browser CWV measurements remain unverified.

Robots, canonicals, and llms.txt are discovery signals, not access controls or guarantees of ranking or AI citation. Existing shared Foundry manifests remain public by design.
Field Core Web Vitals require real-user data. Lab fetch timings cannot establish INP or a production CWV pass. No tracking is removed or added by this work.
Uploaded content authors must supply meaningful Markdown image descriptions; missing alt text defaults to empty rather than fabricated descriptions.
Production HTTPS/alternate-host redirects depend on Vercel domain settings and must be checked after deployment. Never redirect local HTTP development to production.
Authenticated visual/upload testing requires an isolated database and storage; do not test mutations against production merely for SEO verification.
