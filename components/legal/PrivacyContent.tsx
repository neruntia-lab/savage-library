import { SITE_CONFIG } from "../../lib/config/site";

export function PrivacyContent({ nested = false }: { nested?: boolean } = {}) {
  const Heading = nested ? "h3" : "h2";
  return (
    <div className="legal-content">
      <p>
        Savage Library provides digital tabletop resources and verifies access
        to member-only content. This policy explains the information used to
        operate those services.
      </p>

      <Heading>Information we process</Heading>
      <ul>
        <li>
          Account identity, display name, email address, and verification
          status.
        </li>
        <li>
          Patreon account identifiers, campaign membership status, and entitled
          tier identifiers.
        </li>
        <li>
          Complimentary access grants, expiration and revocation history, and
          administrator audit notes.
        </li>
        <li>
          Download and protected-link access records, including a pseudonymous
          visitor identifier.
        </li>
        <li>
          Operational records such as sign-in tokens, rate limits, webhook
          deliveries, and synchronization errors.
        </li>
      </ul>
      <p>
        We do not request Patreon mailing addresses or store complete
        payment-card details. Patreon controls its own billing information under
        Patreon&apos;s privacy practices.
      </p>

      <Heading>How information is used</Heading>
      <p>
        Information is used to authenticate users, verify paid or complimentary
        access, deliver authorized files, prevent abuse, synchronize creator
        content, maintain audit history, and diagnose service failures. We do
        not sell personal information.
      </p>

      <Heading>Service providers</Heading>
      <p>
        Savage Library relies on Vercel for application and file hosting and web
        analytics, Neon for database hosting, Patreon for membership
        verification, Auth.js for authentication workflows, and the configured
        email provider for magic links. These providers process information only
        as needed to supply their services and under their own applicable terms.
      </p>

      <Heading>Cookies and sign-in links</Heading>
      <p>
        Savage Library uses essential cookies to keep you signed in, protect
        account access, remember your return location, and connect your Patreon
        account securely.
      </p>
      <p>
        We do not use advertising or analytics cookies. You can block or delete
        cookies in your browser, but doing so may prevent sign-in, Patreon
        linking, and member downloads.
      </p>
      <p>
        Email sign-in links use one-time verification tokens that expire after
        15 minutes.
      </p>

      <Heading>Web analytics</Heading>
      <p>
        We use Vercel Web Analytics on production public pages to understand
        visitor totals and page views and improve the website. Vercel processes
        page paths, visit timestamps, referring websites, approximate location,
        and device, browser, and operating-system information for aggregate
        traffic reports. This measurement does not use analytics cookies.
      </p>
      <p>
        Vercel distinguishes visitors using a hash derived from incoming
        requests and states that visitor sessions are discarded after 24 hours.
        This is not a promise that aggregate reports are deleted after 24 hours;
        analytics-record retention depends on Vercel&apos;s project plan and
        policies.
      </p>
      <p>
        We exclude private account, authentication, administration, API, and
        draft-preview pages and remove query strings and fragments before
        sending page URLs. We do not attach names, emails, account identifiers,
        membership tiers, or protected download destinations to analytics
        events. These traffic measurements are separate from essential sign-in
        cookies and operational download records; page views do not confirm
        completed file downloads. See{" "}
        <a href="https://vercel.com/docs/analytics/privacy-policy">
          Vercel&apos;s Web Analytics privacy information
        </a>{" "}
        for details.
      </p>

      <Heading>Retention and security</Heading>
      <p>
        Records are retained for as long as necessary to operate accounts,
        enforce access, meet legal obligations, resolve disputes, and protect
        the service. Tokens and creator credentials are protected in transit and
        sensitive creator credentials are encrypted at rest. No online service
        can guarantee absolute security.
      </p>

      <Heading>Your choices</Heading>
      <p>
        You may disconnect Patreon through your account controls where
        available. To request access to, correction of, or deletion of your
        website account information, contact{" "}
        <a href={`mailto:${SITE_CONFIG.supportEmail}`}>
          {SITE_CONFIG.supportEmail}
        </a>
        . Some audit or legal records may be retained when required or when
        needed to protect the service.
      </p>

      <Heading>Policy changes</Heading>
      <p>
        Material changes will be posted on this page with a revised effective
        date. Continued use after a change means the updated policy applies to
        future use.
      </p>
    </div>
  );
}
