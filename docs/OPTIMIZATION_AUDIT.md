# Optimization and maintainability audit — October 8, 2026

## Scope and boundaries

Work targets `development`, starting at `25cfa94`. Production `main` remains in
maintenance mode; no hosted database, membership, storage, or publication writes
were performed. User attachments and shareable exports are untouched.

The inventory covers first-party website source, publishing tools, tests,
configuration, documentation, assets, and migration history. Dependency/build
output and independent Foundry module workspaces are excluded from refactoring.
`audit-inventory.mjs` inventories all scoped files; `audit-structure.mjs` reads
all scoped source files, lists imports and large files, and checks repeated named
function bodies and exact CSS rules. These checks are evidence, not a formal
certification that every line satisfies SOLID or that no semantic duplication exists.

## Implemented findings

| Finding | Resolution |
| --- | --- |
| Homepage rendered every matching entry | Fixed 24-entry initial batch; accessible Load more, duplicate-ID protection, interrupted-request cleanup, failure retention, retry, and ordinary GET pagination without JavaScript. |
| Global loading boundary required streaming scripts to reveal public content | Scoped the skeleton to `/admin`; public pages render their initial content without that boundary. Filter controls retain their pending feedback. |
| Public database reads fetched unused private columns | Explicit catalog projection excludes publisher hashes, destinations, full descriptions, and unrelated persistence fields. Local fixture results also pass through the public summary mapper. |
| Search differed between database and preview | Case-insensitive database search; literal `%`, `_`, and backslash handling; stable resource-ID sort tie breakers. |
| Out-of-range database pages advertised a clamped page but returned the wrong rows | Re-query the clamped page when necessary; shared pagination arithmetic for new admin/Wiki queries. |
| Foundry build-specific compatibility strings could fail integer casts | Extract the leading major version consistently with preview filtering. |
| Dashboard loaded every resource and computed totals in the browser | 50-row database pages, debounced server search/status filters, independent aggregate totals, and cancelled stale reads. |
| Wiki listing/detail reads loaded all guide bodies | 20-guide SQL pages, bounded admin lists, direct published-slug lookup, and lightweight module-choice reads. Public reads select only published snapshots. |
| Sitemap repeatedly counted and joined the catalog for each page | Two lightweight queries for public resource and guide URLs, without resource bodies, tags, or private destinations. |
| Resource repository mixed unrelated read responsibilities | Separate catalog queries, admin reads, and public mapping; retain the existing resource-repository facade for callers. Remove the unused featured-list helper. |
| Resource create/update could partially persist related records | Interactive connection-scoped transactions encompass resource metadata, versions, tags, dependencies, changelog, translations, and tier assignments. Update locks the resource row. |
| Artwork file records and resource keys could diverge | Persist both in one transaction. Resource-level artwork resolves its current version while holding a resource lock. Replaced Blob deletion starts only after commit. |
| Import approval could create partial resources/taxonomy | Candidate, taxonomy, resource/version relations, and approval bookkeeping share one transaction; selected resource is read in that transaction. |
| Patreon member/post records could diverge from tiers/links | Per-record transactions encompass member tiers/manual-grant replacement and imported post/link refresh. |
| Each imported post re-read the entire catalog to match a resource | One indexed identity snapshot per full post reconciliation; explicit key/URL/title precedence and ambiguous-URL rejection. |
| Patreon reads could hang or fail immediately on transient errors | Shared read-only transport: 20-second timeout per attempt, maximum three attempts, capped Retry-After/backoff. Authentication failures are not retried. |
| Manual/cron/member-webhook scans could overlap | Atomic, recoverable row lease with heartbeat and ownership checks. Uses the existing operational-state table and works with transaction-pooled Neon URLs; no session advisory lock or long-lived SQL transaction around external HTTP. |
| All dashboard tabs and module-release UI were eagerly bundled | Lazy-loaded dashboard panels and editor module-release manager using installed Next.js guidance. |
| Duplicate slug and byte-formatting implementations | Reuse the existing pure wizard slug function and shared formatter. Resource create/update share one explicit metadata mapper. |
| Retired category cards retained overlapping style rules | Remove only selectors for the unused category cards/icons/copy/grid; preserve shared rules, cascade, palette, logo, and responsive card styling. |
| Verification depended on manual runs | Development CI runs lint, types, unit/database tests, production build, HTTP flows, and progressive-catalog browser checks. |

No database migration was added or rewritten. The reconciliation lease uses a
separate operational row; historical migrations were exercised in ephemeral PGlite.
Private-download authorization, Patreon/manual-grant rules, CLI packaging/token
boundaries, and stable production Foundry URLs remain unchanged.

## Measurements and interpretation

Baseline: 101 passing tests; lint and TypeScript clean. Final: 105 passing tests,
including isolated PostgreSQL-compatible migration/write rollback tests and a
10,000-entry catalog fixture. Lint, TypeScript, build, and 15 HTTP flows pass.

| Measurement | Baseline | Verified build snapshot |
| --- | ---: | ---: |
| Aggregate emitted JavaScript chunks | 968,195 bytes | 964,659 bytes |
| Aggregate emitted CSS chunks | 98,276 bytes | 96,081 bytes |
| Source stylesheet bytes | 116,080 | 113,357 |
| Initial homepage resource count at 10,000 entries | 10,000 | 24 |
| Wiki listing bodies fetched per page | All guides | At most 20 |
| Admin resource rows fetched per page | All resources | At most 50 |
| Sitemap data queries at 10,000 resources | Hundreds of paginated queries | 2 |

Chunk totals are all emitted assets, not initial-route transfer sizes or a measured
production latency benchmark. Route-specific savings from lazy tabs require hosted
profiling. The source inventory grew from roughly 27.5k to 28.5k lines because of
bounded browsing, transaction safety, retry/lease handling, and diagnostic tools.
This is **not** an overall source-line reduction. Concrete duplicate implementations
and unused styles were removed; correctness and lower request/data cost took
priority over minifying or deleting useful behavior to meet a line-count target.

The repeated-function scan currently finds no exact duplicate named-function bodies
above its 150-character threshold. It does not detect all duplicated JSX, hooks,
arrow functions, or semantically similar code. Stylesheet scanning finds no exact
duplicate rules; differing-value overrides are not automatically safe to remove.

## Verification details

- Resource create/update rollback leaves metadata, version selection, translations,
  and automatic Wiki starter creation unchanged after injected relation failures.
- Artwork rollback leaves both file records and artwork keys unchanged; repeated
  persistence is idempotent within the existing file identity constraint.
- A 10,000-entry SQL fixture verifies bounded pages, deterministic tie ordering,
  clamped last-page results, case-insensitive search, literal wildcard queries,
  build-specific Foundry compatibility, and summary destination/hash secrecy.
- Lease claims reject overlap and allow takeover after expiration in isolated SQL.
- Transport tests verify bounded transient retries, capped delays, sanitized network
  errors, timeout signals, and immediate rejection of invalid authentication.
- Browser checks cover 122 template/state captures at 390, 820, and 1440 pixels
  with no document overflow or uncaught JavaScript errors. Representative screenshots
  were inspected for the preserved ornamental aesthetic and layout.
- Dedicated homepage and Wiki scripts test controls, keyboard focus, search,
  navigation, languages, validation, previews, logout, and read-only mutation safety.
- A separate 65-entry built preview verifies 24 → 48 → 65 Load more behavior,
  API-failure retention, retry, uniqueness, and actual JavaScript-disabled navigation.
- Runtime dependency audit reports zero vulnerabilities. Nine development-only
  advisory-chain entries remain in ESLint globbing and Drizzle's bundled esbuild
  tooling. The registry's latest `braces` is still 3.0.3; npm's proposed forced
  fixes downgrade major framework/migration tooling. Those changes were not applied.
- Windows sandbox build/process restrictions required elevated build/browser runs.
  Stale local compilation was cleared by moving generated `.next/dev` into an
  ignored, recoverable `work/dev-cache-audit-backup`; no project data was deleted.

## Remaining work and integration limits

This is the verified first optimization pass, not the completion of every item in
the broader roadmap. Remaining items are explicit:

1. **Patreon checkpoints and job continuation.** Reads and overlapping runs are
   bounded/protected, but full reconciliation still restarts after interruption
   and can exceed serverless duration for large campaigns. Add durable page
   checkpoints, generation-scoped stale detection, and a continuation scheduler
   before claiming large-campaign scalability. Keep partial scans from deactivating
   unseen members/posts.
2. **Hosted integration checks.** A separate development database, isolated Blob
   stores, SMTP, and Patreon credentials were not supplied. Actual Neon connection
   behavior, storage replacement races/callbacks, OAuth refresh/linking, email,
   wizard persistence/resumption, publication/rollback, and Foundry installation
   still need those services. Production was not used as a test database.
3. **Measured indexes/search plans.** No speculative indexes were added. Capture
   `EXPLAIN (ANALYZE, BUFFERS)` for representative hosted queries before adding
   sort/filter/trigram indexes. Leading-wildcard and Wiki-body search still scan
   text; the 10,000-row correctness test is not a hosted performance guarantee.
4. **Large editor and CSS ownership.** WizardSteps and ResourceWorkspace still
   contain substantial UI orchestration. Further extract workflow-specific step
   components and move overlapping global styles into scoped component ownership
   with production-cascade/browser parity tests. Admin/public declarations are
   interleaved, so moving entire stylesheets would silently break public pages.
5. **Assets and large association lists.** Default hero artwork is already WebP;
   the 2.24 MB social PNG and older externally-addressable assets were inventoried,
   not replaced/deleted. Module association choices remain lightweight but unbounded;
   use searchable remote pickers if these grow large. Split sitemaps above 50,000 URLs.
6. **Browser/security scope.** Chromium checks do not replace physical Safari,
   Firefox, screen-reader, or native file-picker verification. Track development-tool
   advisories without exposing development servers publicly or forcing major downgrades.

The earlier authorized production/development counter reset still requires database
credentials and backups. This pass does not claim those resets were performed.

## Repeatable commands

```sh
npm run audit:structure
node scripts/audit-inventory.mjs --markdown
npm run lint
npm run typecheck
npm test
npm run build
npm run test:flows
npm audit --omit=dev
npm run preview:local
node scripts/visual-audit.mjs
node scripts/wiki-browser-check.mjs
node scripts/homepage-browser-check.mjs
node scripts/preview.mjs --built --port 3400 --catalog-size 65
node scripts/progressive-catalog-check.mjs
```

Preview launchers bind only to loopback and clear write/service credentials.
Set `PREVIEW_ORIGIN` if another port was selected. Set `SAVAGE_VISUAL_BROWSER`
when using a preinstalled browser executable. Do not merge or push this work to
`main`, approve a production database for preview migrations, or remove maintenance
mode without explicit authorization.
