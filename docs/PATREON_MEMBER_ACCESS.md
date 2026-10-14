# Patreon member access

Set `PATREON_MEMBER_CONNECTIONS_ENABLED=true` in Production to enable member
sign-in and explicit account linking. Leave it unset or `false` to pause new
connections; existing member sessions and creator synchronization are preserved.
Email sign-in remains controlled separately by `EMAIL_SIGN_IN_ENABLED`.

The Patreon client must register both production callbacks:

- `https://savage-library.vercel.app/api/auth/callback/patreon`
- `https://savage-library.vercel.app/api/account/link-patreon/callback`

The site requests identity and membership access, never automatically merges
accounts by email, and checks currently entitled campaign tier IDs. Any assigned
tier qualifies. Complimentary grants and administrator access retain their
existing behavior. Verification failures deny protected website delivery.

## Shared module links are not piracy protection

The website reveals a paid module's manifest control only after tier verification.
The stable manifest and version-specific ZIP endpoints intentionally require no
session so Foundry can install and automatically update the module. Anyone who
receives or guesses these URLs can use them, including after cancellation.
Do not describe these module endpoints as subscriber-protected delivery.

Only published module resources with published releases (or previously published,
superseded releases for version-specific ZIPs) are distributed. Draft/failed
releases and unpublished resources remain unavailable. Blob objects stay private;
the site issues short-lived delivery redirects and tracks successful requests.
PDFs, macros, and other website downloads still require authorization on every
request. Publishing, tier assignments, and resource visibility remain explicit
administrator decisions; enabling sign-in publishes no existing draft.

## Recovery and verification

Revert the connection flag to pause new member OAuth flows. This does not disable
shared Foundry URLs or revoke existing sessions. To revert shared distribution,
restore the previous production deployment or unpublish the affected resource.
Do not undo database history or delete content during rollback.

Unit/database and isolated HTTP-flow tests cover access states, tier matching,
paused/enabled OAuth entry points, safe return locations, private download
boundaries, and published versus unpublished shared releases. A real patron must
complete Patreon consent to verify the live callback and tier display end to end.
