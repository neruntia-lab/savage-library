import type { Metadata } from "next";
import { TermsContent } from "../../components/legal/TermsContent";
import { PrivacyContent } from "../../components/legal/PrivacyContent";

export const metadata: Metadata = {
  title: "Terms & Privacy",
  description: "Savage Library terms of service and privacy policy.",
};
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
          <TermsContent />
        </section>
        <section
          id="privacy"
          className="legal-policy-section"
          aria-labelledby="privacy-title"
        >
          <h2 id="privacy-title">Privacy policy</h2>
          <PrivacyContent />
        </section>
      </div>
    </section>
  );
}
