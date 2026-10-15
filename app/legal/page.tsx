import { pageMetadata } from "../../lib/seo";
import type { Metadata } from "next";
import { TermsContent } from "../../components/legal/TermsContent";
import { PrivacyContent } from "../../components/legal/PrivacyContent";

export const metadata: Metadata = pageMetadata(
  "Terms & Privacy",
  "Read Savage Library’s terms of service, membership conditions, and privacy policy.",
  "/legal",
);
export default function LegalPage() {
  return (
    <section className="page-section legal-page">
      <div className="container">
        <header className="page-heading">
          <p className="eyebrow">Library policies</p>
          <h1>Terms & Privacy</h1>
          <p>Effective August 11, 2026</p>
        </header>
        <nav className="wiki-language-tabs" aria-label="Legal sections">
          <a href="#terms">Terms & Conditions</a>
          <a href="#privacy">Privacy policy</a>
        </nav>
        <section
          id="terms"
          className="legal-policy-section"
          aria-labelledby="terms-title"
        >
          <h2 id="terms-title">Terms & Conditions</h2>
          <TermsContent nested />
        </section>
        <section
          id="privacy"
          className="legal-policy-section"
          aria-labelledby="privacy-title"
        >
          <h2 id="privacy-title">Privacy policy</h2>
          <PrivacyContent nested />
        </section>
      </div>
    </section>
  );
}
