import { SITE_CONFIG } from "../../lib/config/site";

export function PrivacyContent({ nested = false }: { nested?: boolean } = {}) {
  const Heading = nested ? "h3" : "h2";
  return (
    <div className="legal-content">
      <p>
        We process information to operate Savage Library and verify resource access.
      </p>

      <Heading>Information we process</Heading>
      <ul>
        <li>
          Account identity, display name, email, and verification status.
        </li>
        <li>
          Patreon account identifiers, membership status, and entitled tiers.
        </li>
        <li>
          Complimentary grants, expiry, revocations, and admin audit notes.
        </li>
        <li>
          Download and protected-link records with a pseudonymous visitor identifier.
        </li>
        <li>
          Sign-in tokens, rate limits, webhooks, and synchronization errors.
        </li>
      </ul>
      <p>
        We do not request Patreon mailing addresses or store full card details.
        Patreon handles billing data.
      </p>

      <Heading>How information is used</Heading>
      <p>
        We use data for sign-in, access checks, file delivery, abuse prevention,
        content synchronization, audits, and troubleshooting. We do not sell personal information.
      </p>

      <Heading>Service providers</Heading>
      <p>
        Vercel hosts the site, files, and analytics; Neon hosts the database.
        Patreon verifies memberships, Auth.js supports authentication, and our
        email provider delivers sign-in links. Providers process necessary data
        under their own terms.
      </p>

      <Heading>Cookies and sign-in links</Heading>
      <p>
        Essential cookies support sign-in, security, return locations, and Patreon
        linking. We do not use advertising or analytics cookies. Blocking or deleting
        cookies may prevent sign-in, linking, and member downloads. Email sign-in
        tokens work once and expire after 15 minutes.
      </p>

      <Heading>Web analytics</Heading>
      <p>
        Vercel Web Analytics measures public-page traffic without cookies, using
        paths, timestamps, referrers, approximate location, and device/browser/OS
        information. Private, admin, authentication, API, and draft-preview pages
        are excluded. We strip URL queries and fragments and attach no account,
        membership, or protected-link data.
      </p>
      <p>
        Measurement is separate from sign-in cookies and download records.
        Vercel discards request-derived visitor sessions after 24 hours; report
        retention depends on its plan and policies. See{" "}
        <a href="https://vercel.com/docs/analytics/privacy-policy">
          Vercel&apos;s Web Analytics privacy information
        </a>.
      </p>

      <Heading>Retention and security</Heading>
      <p>
        We retain records as needed for accounts, access, legal obligations,
        disputes, and security. Credentials are protected in transit; sensitive
        creator credentials are encrypted at rest. Absolute security cannot be guaranteed.
      </p>

      <Heading>Your choices</Heading>
      <p>
        Disconnect Patreon through available account controls. For data access,
        correction, or deletion, contact{" "}
        <a href={`mailto:${SITE_CONFIG.supportEmail}`}>
          {SITE_CONFIG.supportEmail}
        </a>
        . Necessary audit or legal records may be retained.
      </p>

      <Heading>Policy changes</Heading>
      <p>
        Material changes will appear here with a new effective date and apply to future use.
      </p>
    </div>
  );
}
