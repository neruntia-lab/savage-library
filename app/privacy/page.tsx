import type { Metadata } from "next";
import { PrivacyContent } from "../../components/legal/PrivacyContent";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Savage Library collects, uses, and protects account and membership information.",
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
        <PrivacyContent />
      </div>
    </section>
  );
}
