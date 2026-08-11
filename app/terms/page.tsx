import type { Metadata } from "next";
import { SITE_CONFIG } from "../../lib/config/site";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Terms governing use of Savage Library and its downloadable resources.",
};

export default function TermsPage() {
  return (
    <section className="page-section legal-page">
      <div className="container">
        <header className="page-heading">
          <p className="eyebrow">Authorized use</p>
          <h1>Terms of service</h1>
          <p>Effective August 11, 2026</p>
        </header>
        <div className="legal-content">
          <p>
            These terms govern access to Savage Library, including its catalog,
            Foundry VTT packages, documents, macros, and member-only downloads. By
            using the service, you agree to these terms.
          </p>

          <h2>Accounts and access</h2>
          <p>
            You are responsible for activity under your session and for protecting
            sign-in links and connected accounts. Patreon access depends on the tiers
            currently reported by Patreon. Complimentary access may expire or be
            revoked according to the grant issued by an administrator.
          </p>

          <h2>Licenses and permitted use</h2>
          <p>
            Each resource remains subject to the license and attribution displayed on
            its catalog page or included in its files. Access to a download is not a
            transfer of copyright. Unless the resource license expressly permits it,
            you may not redistribute, resell, publicly mirror, remove attribution
            from, or share restricted download destinations or access credentials.
          </p>

          <h2>Membership and availability</h2>
          <p>
            Member-only access is available only while a qualifying Patreon
            entitlement or active complimentary grant can be verified. Cancellation,
            tier changes, expiration, account-linking failures, or provider outages
            may change availability. Patreon manages subscriptions, charges, refunds,
            and billing disputes under Patreon&apos;s own terms.
          </p>

          <h2>Acceptable use</h2>
          <p>
            Do not attempt to bypass access checks, probe private file destinations,
            interfere with the service, automate abusive traffic, upload malicious
            material, impersonate another person, or use the service in violation of
            law or third-party rights.
          </p>

          <h2>Service changes and termination</h2>
          <p>
            Resources, compatibility information, and service features may change.
            Access may be suspended or terminated for abuse, unauthorized
            redistribution, security risks, or violations of these terms. Reasonable
            efforts are made to preserve published releases, but uninterrupted or
            permanent availability is not guaranteed.
          </p>

          <h2>Disclaimers</h2>
          <p>
            The service and resources are provided on an “as available” basis to the
            extent permitted by law. Compatibility labels are informational and may
            not cover every Foundry VTT, game-system, or module combination. Foundry
            Virtual Tabletop and Patreon are third-party services; Savage Library is
            not responsible for their availability or policies.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms may be sent to <a href={`mailto:${SITE_CONFIG.supportEmail}`}>{SITE_CONFIG.supportEmail}</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
