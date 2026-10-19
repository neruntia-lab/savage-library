import { pageMetadata } from "../../lib/seo";
import type { Metadata } from "next";
import { PrivacyContent } from "../../components/legal/PrivacyContent";
import { PRIVACY_EFFECTIVE_DATE } from "../../lib/config/legal";

export const metadata: Metadata = pageMetadata(
  "Privacy policy",
  "How Savage Library collects, uses, and protects account and membership information.",
  "/legal#privacy",
);

export default function PrivacyPage() {
  return (
    <section className="page-section legal-page">
      <div className="container">
        <header className="page-heading">
          <p className="eyebrow">Account and membership data</p>
          <h1>Privacy policy</h1>
          <p>Effective {PRIVACY_EFFECTIVE_DATE}</p>
        </header>
        <PrivacyContent />
      </div>
    </section>
  );
}
