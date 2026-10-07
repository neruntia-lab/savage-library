# Development code audit and ornamental redesign

Audit date: October 7, 2026. Branch: `development`. Starting snapshot: `65dcee8`.
Production `main` remains at its maintenance-mode restore point; no production
data, Blob objects, migrations, or publisher releases were changed by this work.

## Scope and method

The inventory covers the deployable website, publisher CLI, configuration,
tests, documentation, database schema, migration SQL/history, and public assets.
See [the file inventory](./DEVELOPMENT_INVENTORY.md). Dependencies and generated
build output were checked with their tooling rather than treated as source.
Separate `Mods`, `Macros`, and source-artwork folders, untracked attachments,
and shareable exports were preserved and not refactored.

Excluded source inventory: `Mods/savage-messages`, `Mods/starmessage`,
`Macros/Animaions`, and `Macros/Utility`. Their source and artifacts were not
changed. The independently scoped external `simple-quest` workspace was also
left untouched.

The review concentrated on concrete responsibility boundaries, duplicated code,
async failure paths, authorization, private/public storage separation, resource
cleanup, input validation, and CSS cascade/layout problems. This is a practical
engineering audit, not a certification that every function satisfies a formal
interpretation of DRY or SOLID.

Installed Next.js guides for CSS, server/client components, and response headers
were read before changing framework behavior. The compatible dependency audit
updated Next.js to 16.4 and patched runtime dependencies. Nodemailer required
an explicit update to the patched 10.x line; real SMTP delivery still needs the
separate development integration checks listed below.

## Findings and resolutions

| Finding | Resolution |
| --- | --- |
| Wizard/editor repeated upload metadata, progress, artwork finalization, and object-URL handling. | Shared `resource-upload` workflow and `useResourceUploads` hook. Slots remain independent, failed previews are explicitly unsaved, and temporary URLs are revoked on replacement/success/unmount. |
| Artwork completion could be trusted without a confirmed owning resource/slot. | Finalization must confirm resource identity, persistence, and the corresponding canonical URL. Tests reject mismatched confirmations. Existing server-side Blob verification is retained. |
| Network failures could leave admin controls busy; HTML errors were parsed inconsistently. | Shared same-origin request helpers preserve useful validation/authentication errors and return recoverable network/malformed-response errors. Successful 204 deletes remain successful. |
| An upload could overwrite text typed while it was running. | Functional state updates append description images to the latest text, not the upload's old snapshot. |
| Changing dirty state prematurely revoked local wizard artwork previews. | Preview lifecycle now belongs to the upload hook instead of a dirty-state effect. |
| Edits entered during an autosave could miss the save debounce. | Change counters schedule the pending edits after an in-flight save; a failed attempt does not spin an automatic retry loop or claim all changes were saved. |
| Publisher refresh timers survived leaving the editor. | Timer handles are tracked and cleared on unmount. |
| Large editor/wizard files mixed rendering, persistence payloads, and workflows. | Extracted editor fields, translation fields, dependencies, wizard steps, form payload builder, upload services, and lifecycle hook. Removed the unused legacy editor after checking references. |
| Resource route mixed authorization/data loading with several hundred lines of view markup. | Shared `ResourcePresentation` renders published pages and authorized previews. Route retains loading and access decisions. |
| Resource repository mixed example seeding, reads, and writes. | Seed and write responsibilities moved into focused repositories; facade exports preserve existing callers and API contracts. Transaction semantics were not silently changed. |
| One large stylesheet accumulated exact-selector shadowed declarations and obsolete News rules. | Organized imports by foundation, catalog, administration, responsive layout, home, wizard, and reference theme. Removed exact shadowed declarations without reordering the cascade; removed unused News styling. |
| Empty review text was placed in an icon-sized grid column. | Checklist entries now use semantic lists with explicit icon/message columns; empty-state text remains full width. |
| Mobile wizard save errors were only announced in a hidden desktop sidebar. | The visible action bar now shows the current status/error on all widths. |
| `X-Frame-Options: DENY` blocked the wizard's own preview. | Same-origin framing plus CSP `frame-ancestors 'self'` permits the authenticated preview while blocking external framing. Preview authorization and disabled delivery actions remain enforced. |
| Invalid JSON shapes in module manifests could throw instead of returning validation feedback. | Explicit object/string checks, manifest expansion limit, archive entry/expanded-size limits, duplicate-path checks, and environment-file variant checks. |
| CLI packaging could include environment files or nested ZIPs later rejected by the site. | Extracted packaging module excludes secrets, tracked publisher metadata, nested archives, and configured ignore paths. Symlinks are rejected; file timestamps yield repeatable archives for unchanged inputs. |
| Local design work could accidentally load production credentials. | Dedicated loopback-only preview launcher blanks database/storage/OAuth/creator/SMTP credentials, uses sample catalog data and a local-only admin password, and disables database/storage access. Vercel cannot enable fixture mode. |
| Older locked dependencies contained security advisories. | Applied compatible fixes and the patched mail library. Runtime dependency audit reports zero advisories; remaining dev-tool advisories are documented below. |

## Responsibility map

- Routes: HTTP parsing, authentication/authorization, response status, redirects.
- Services: publication, entitlement resolution, validation/sanitization, sync workflows.
- Repositories: database/Blob persistence, stable facade contracts, immutable release history.
- Client workflows: authenticated JSON requests, upload authorization/finalization/progress.
- Hooks: component-owned lifecycle, local preview URLs, per-slot concurrency.
- View components: shared resource rendering and cohesive wizard/editor sections.
- CLI: command orchestration, catalog configuration, packaging, upload diagnostics.

No external AI classification service, new icon library, remote font service,
schema migration, paid updater key, or personalized manifest was introduced.

## Design system

Night Ink `#090B0F` is the background; Aged Vellum `#F1E8D6` is primary text.
Infernal Wine `#5B0E18` is reserved for action surfaces, not small text on black.
Occult Gold `#C7A14D` and its brighter derived shade mark frames, ornaments,
links, and focus. Smoke Plum `#4B2E4D` supplies callout surfaces.

Local Georgia/Times serif headings and system sans-serif UI text need no font
service. Decorative SVG corners and celestial sun/moon motifs are lightweight,
noninteractive, and hidden from assistive technology. Existing logo assets
are unchanged. Reduced-motion rules and visible focus states remain in place.
Contrast tests enforce at least 4.5:1 for normal-text token pairs.

Mobile resource tables become labeled full-width cards; action bars stay within
the form width. Language tabs remain in normal flow. Gold frames do not consume
control hit areas.

## Verification and reproduction

Baseline lint, TypeScript, unit tests (56), and production build passed. The
first sandboxed HTTP run could not start the compiler due to Windows permissions;
the isolated production-build HTTP suite passed when run with the required
process permissions. That was an environment failure, not a baseline app defect.

Final commands:

Final results: lint and TypeScript passed; 68 unit tests and 11 HTTP-flow tests
passed; the production build completed. The runtime dependency audit reports
zero vulnerabilities. Browser inspection covers phone, tablet, and desktop
templates plus required-field, interrupted-save, preview, menu, and logout states.

```sh
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run test:flows
npm audit --omit=dev
npm run preview:local
node scripts/visual-audit.mjs
node scripts/audit-inventory.mjs --markdown
```

Unit coverage includes network/HTML/auth errors, 204 deletion, upload failure and
confirmed artwork ownership, local preview safety, contrast, malformed manifests,
packaging exclusions/reproducibility, existing publication checks, Markdown,
Patreon entitlement logic, webhook idempotency, and CLI configuration.
HTTP coverage includes public discovery/legal/resource pages, authentication,
admin taxonomy reads, protected wizard/publisher APIs, authorized draft preview,
same-origin frame headers, and publisher credential rejection.

The browser audit checks 390px, 820px, and 1440px widths. Its screenshots/report
are generated under ignored `work/visual-audit/`. Reviewed templates include
home, catalog/search/empty/filter/category variants, resource and draft preview,
account, legal, not-found, sign-in/sign-out, every dashboard tab, full editor,
all wizard steps and resource-type upload variants, loading/error boundaries,
required-field feedback, interrupted-save recovery, embedded preview, and logout.

## Remaining limitations and integration checklist

- No separate development database, Patreon campaign credentials, SMTP sender,
  or isolated Blob stores were supplied for mutation integration tests. Artwork
  persistence, taxonomy writes, wizard reload/resumption, transactional publish
  and rollback, OAuth linking, real membership refresh, email delivery, and real
  Foundry install/update must be exercised against those services before merging.
  Production data was deliberately not used to fill this gap.
- Legacy resource create/update relation writes remain multi-statement workflows;
  module release publication and artwork persistence retain their existing
  transactional implementation. A wider transaction redesign requires isolated
  database failure-injection tests; it was not attempted without them.
- Some legacy catalog reads fall back to bundled examples after database failure.
  This preserved contract can hide availability problems and merits a separate
  observable degraded-mode change before production return.
- Some legacy repositories still coordinate small workflow steps. Extraction
  was limited to demonstrated duplication/responsibility problems rather than
  adding speculative interfaces across every file.
- Dev-only advisory chains remain in ESLint globbing (`braces`) and Drizzle's
  bundled esbuild tooling. npm's forced recommendations downgrade major tooling;
  they were not applied blindly. Do not expose development tool servers publicly.
- Browser coverage uses Chromium, not physical-device Safari/Firefox testing.
  Screen-reader and OS-native file-picker testing remain manual checks.
- The local preview is intentionally read-only. Use `npm run dev` only after
  configuring separate development services; never copy production secrets for
  mutation testing. Real publisher and Foundry URLs remain on the production origin.

Production maintenance stays enabled until explicitly authorized to return.
