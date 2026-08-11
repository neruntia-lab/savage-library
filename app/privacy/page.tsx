import type { Metadata } from "next";
import { SITE_CONFIG } from "../../lib/config/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Savage Library collects, uses, and protects account and membership information.",
};

export default function PrivacyPage() {
  return (
    <section className="page-section legal-page">
      <div className="container">
        <header className="page-heading">
          <p className="eyebrow">Account and membership data</p>
          <h1>Privacy policy</h1>
          <p>Effective August 11, 2026</p>
        </header>
        <div className="legal-content">
          <p>
            Savage Library provides digital tabletop resources and verifies access
            to member-only content. This policy explains the information used to
            operate those services.
          </p>

          <h2>Information we process</h2>
          <ul>
            <li>Account identity, display name, email address, and verification status.</li>
            <li>Patreon account identifiers, campaign membership status, and entitled tier identifiers.</li>
            <li>Complimentary access grants, expiration and revocation history, and administrator audit notes.</li>
            <li>Download and protected-link access records, including a pseudonymous visitor identifier.</li>
            <li>Operational records such as sign-in tokens, rate limits, webhook deliveries, and synchronization errors.</li>
          </ul>
          <p>
            We do not request Patreon mailing addresses or store complete payment-card
            details. Patreon controls its own billing information under Patreon&apos;s
            privacy practices.
          </p>

          <h2>How information is used</h2>
          <p>
            Information is used to authenticate users, verify paid or complimentary
            access, deliver authorized files, prevent abuse, synchronize creator
            content, maintain audit history, and diagnose service failures. We do not
            sell personal information.
          </p>

          <h2>Service providers</h2>
          <p>
            Savage Library relies on Vercel for application and file hosting, Neon
            for database hosting, Patreon for membership verification, Auth.js for
            authentication workflows, and the configured email provider for magic
            links. These providers process information only as needed to supply their
            services and under their own applicable terms.
          </p>

          <h2>Cookies and sign-in links</h2>
          <p>
            Essential cookies protect sessions and OAuth account linking. Email
            sign-in links are one-time tokens with a short expiration. The site does
            not require advertising cookies.
          </p>

          <h2>Retention and security</h2>
          <p>
            Records are retained for as long as necessary to operate accounts,
            enforce access, meet legal obligations, resolve disputes, and protect the
            service. Tokens and creator credentials are protected in transit and
            sensitive creator credentials are encrypted at rest. No online service
            can guarantee absolute security.
          </p>

          <h2>Your choices</h2>
          <p>
            You may disconnect Patreon through your account controls where available.
            To request access to, correction of, or deletion of your website account
            information, contact <a href={`mailto:${SITE_CONFIG.supportEmail}`}>{SITE_CONFIG.supportEmail}</a>.
            Some audit or legal records may be retained when required or when needed
            to protect the service.
          </p>

          <h2>Policy changes</h2>
          <p>
            Material changes will be posted on this page with a revised effective
            date. Continued use after a change means the updated policy applies to
            future use.
          </p>
        </div>
      </div>
    </section>
  );
}
