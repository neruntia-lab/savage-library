import type { Metadata } from "next";
import { TermsContent } from "../../components/legal/TermsContent";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "Terms governing use of Savage Library and its downloadable resources.",
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
        <TermsContent />
      </div>
    </section>
  );
}
