import { SITE_CONFIG } from "../../lib/config/site";

export function PrivacyContent() {
  return (
    <div className="legal-content">
      <p>
        Savage Library provides digital tabletop resources and verifies access
        to member-only content. This policy explains the information used to
        operate those services.
      </p>

      <h2>Information we process</h2>
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

      <h2>How information is used</h2>
      <p>
        Information is used to authenticate users, verify paid or complimentary
        access, deliver authorized files, prevent abuse, synchronize creator
        content, maintain audit history, and diagnose service failures. We do
        not sell personal information.
      </p>

      <h2>Service providers</h2>
      <p>
        Savage Library relies on Vercel for application and file hosting, Neon
        for database hosting, Patreon for membership verification, Auth.js for
        authentication workflows, and the configured email provider for magic
        links. These providers process information only as needed to supply
        their services and under their own applicable terms.
      </p>

      <h2>Cookies and sign-in links</h2>
      <p>
        Cookies are small pieces of data stored by your browser on your device.
        Your browser sends them back to Savage Library on matching requests.
        We use essential cookies to keep members and administrators signed in,
        protect sign-in requests against forgery, remember the return location
        after authentication, and securely connect Patreon accounts. These
        cookies let us recognize your session without asking you to sign in on
        every page; membership eligibility is checked separately.
      </p>
      <ul>
        <li>
          Sign-in sessions use an encrypted token stored in a browser cookie,
          with a configured lifetime of up to 30 days. The session may be renewed
          during use, and signing out clears the session cookie.
        </li>
        <li>
          Temporary security cookies validate authentication and account-linking
          requests. Authentication state and proof-key cookies expire after
          15 minutes; the explicit Patreon account-linking cookie expires after
          10 minutes and is cleared when linking succeeds. Other authentication
          cookies may last for the browser session.
        </li>
        <li>
          Authentication cookies are marked HttpOnly so page scripts cannot read
          them, use SameSite restrictions to limit cross-site sending, and are
          marked Secure on HTTPS deployments. They are not stored in browser
          local storage.
        </li>
      </ul>
      <p>
        Email sign-in links are separate from cookies. They contain a one-time
        verification token that expires after 15 minutes. A hashed verification
        record is stored in our database and consumed when the link is used;
        successful sign-in then creates a session cookie. Your account and
        membership records are stored separately in the database, not solely
        in cookies.
      </p>
      <p>
        We do not use advertising cookies or include analytics tracking cookies
        in the application. You can delete or block cookies through your browser
        settings. Public content remains available, but blocking essential cookies
        can prevent sign-in, Patreon linking, and authenticated downloads.
      </p>

      <h2>Retention and security</h2>
      <p>
        Records are retained for as long as necessary to operate accounts,
        enforce access, meet legal obligations, resolve disputes, and protect
        the service. Tokens and creator credentials are protected in transit and
        sensitive creator credentials are encrypted at rest. No online service
        can guarantee absolute security.
      </p>

      <h2>Your choices</h2>
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

      <h2>Policy changes</h2>
      <p>
        Material changes will be posted on this page with a revised effective
        date. Continued use after a change means the updated policy applies to
        future use.
      </p>
    </div>
  );
}
