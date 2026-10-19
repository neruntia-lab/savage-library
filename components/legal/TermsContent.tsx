import { SITE_CONFIG } from "../../lib/config/site";

export function TermsContent({ nested = false }: { nested?: boolean } = {}) {
  const Heading = nested ? "h3" : "h2";
  return (
    <div className="legal-content">
      <p>
        By using Savage Library and its resources, you agree to these terms.
      </p>

      <Heading>Accounts and access</Heading>
      <p>
        Protect your sign-in links and connected accounts. You are responsible
        for your account activity. Patreon tiers determine member access;
        complimentary grants may expire or be revoked.
      </p>

      <Heading>Licenses and permitted use</Heading>
      <p>
        Follow each resource&apos;s license and attribution requirements.
        Downloads do not transfer copyright. Unless permitted by that license,
        do not redistribute, resell, mirror, remove attribution, or share
        restricted links or credentials.
      </p>

      <Heading>Membership and availability</Heading>
      <p>
        Protected access requires a verified qualifying membership or grant.
        Cancellation, tier changes, expiry, or verification outages may affect
        access. Patreon handles subscriptions, charges, refunds, and billing disputes.
      </p>

      <Heading>Acceptable use</Heading>
      <p>
        Do not bypass security, probe private files, disrupt the service, send
        abusive traffic, upload malware, impersonate others, or violate laws or
        third-party rights.
      </p>

      <Heading>Service changes and termination</Heading>
      <p>
        Content and features may change. Abuse, unauthorized redistribution,
        security risks, or violations may result in suspension or termination.
        We aim to preserve releases but cannot guarantee permanent availability.
      </p>

      <Heading>Disclaimers</Heading>
      <p>
        Resources are provided “as available,” as permitted by law. Compatibility
        is not guaranteed for every setup. Foundry VTT and Patreon control their
        own services and policies.
      </p>

      <Heading>Contact</Heading>
      <p>
        Questions? Contact{" "}
        <a href={`mailto:${SITE_CONFIG.supportEmail}`}>
          {SITE_CONFIG.supportEmail}
        </a>
        .
      </p>
    </div>
  );
}
