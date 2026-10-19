import { pageMetadata } from "../../lib/seo";
import type { Metadata } from "next";
import { TermsContent } from "../../components/legal/TermsContent";
import { PrivacyContent } from "../../components/legal/PrivacyContent";
import {
  PRIVACY_EFFECTIVE_DATE,
  TERMS_EFFECTIVE_DATE,
} from "../../lib/config/legal";

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
          <p>Effective {TERMS_EFFECTIVE_DATE}</p>
          <TermsContent nested />
        </section>
        <section
          id="privacy"
          className="legal-policy-section"
          aria-labelledby="privacy-title"
        >
          <h2 id="privacy-title">Privacy policy</h2>
          <p>Effective {PRIVACY_EFFECTIVE_DATE}</p>
          <PrivacyContent nested />
        </section>
      </div>
    </section>
  );
}
