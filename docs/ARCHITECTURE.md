# Savage Library architecture

## Runtime

Savage Library is a TypeScript application built with Next.js-compatible React
server components through Vinext and deployed as a Cloudflare Worker.

- Public pages are server rendered and cacheable.
- Cloudflare D1 stores relational catalog, user, and analytics data.
- Cloudflare R2 stores PDFs, Foundry packages, cover art, and manifests.
- ChatGPT sign-in is optional for public browsing and required for account data.
- Admin authorization is enforced server-side with an email allowlist.

## Route structure

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Search-first home and featured resources | Public |
| `/library` | URL-backed search, filters, sort, and pagination | Public |
| `/resources/[slug]` | Resource metadata, files, installation, and changelog | Public |
| `/categories/[slug]` | Modules, classes, subclasses, and PDFs | Public |
| `/account` | Saved resources, download history, profile | Signed in |
| `/admin` | Catalog management and download statistics | Admin |
| `/api/resources` | Catalog query and resource creation | GET public, POST admin |
| `/api/resources/[id]` | Resource update, publication, and deletion | Admin |
| `/api/uploads` | Validated R2 uploads and file metadata | Admin |
| `/api/downloads/[fileId]` | Rate-limited R2 download proxy and tracking | Public or signed in when restricted |
| `/api/saved` | Save and unsave resources | Signed in |

## Boundaries

- `app/` contains routes and presentation composition.
- `components/` contains reusable interface pieces.
- `lib/domain/` owns shared types and compatibility rules.
- `lib/validation/` owns input and upload validation.
- `lib/repositories/` owns all database access.
- `lib/services/` coordinates auth, rate limits, files, and application use cases.
- `db/schema.ts` is the normalized relational schema.

Presentation code never reaches directly into D1 or R2. Route handlers validate
inputs and then call service or repository functions. User-authored content is
stored and rendered as plain text; HTML is not accepted.

## Data relationships

A resource belongs to one author, category, and game system. It can have many
tags, compatible Foundry versions, historical versions, dependencies, files,
and changelog entries. Downloads and saved resources join users to catalog
records without duplicating shared metadata.
