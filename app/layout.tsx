import type { Metadata, Viewport } from "next";
import { canonicalUrl, indexingEnabled, jsonLd } from "../lib/seo";
import { SiteFooter } from "../components/layout/SiteFooter";
import { SiteHeader } from "../components/layout/SiteHeader";
import { SITE_CONFIG } from "../lib/config/site";
import { getAuthorizedUser } from "../lib/services/auth";
import { hasLinkedPatreonAccount } from "../lib/services/linked-patreon";
import { patreonMemberConnectionsEnabled } from "../lib/config/patreon-members";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const origin = canonicalUrl("/");
  const socialImage = canonicalUrl("/og-social.jpg");
  return {
    metadataBase: new URL(origin),
    robots: indexingEnabled()
      ? { index: true, follow: true }
      : { index: false, follow: false },
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
    title: {
      default: SITE_CONFIG.name,
      template: `%s · ${SITE_CONFIG.name}`,
    },
    description: SITE_CONFIG.description,
    applicationName: SITE_CONFIG.name,
    keywords: [
      "Foundry VTT",
      "tabletop RPG",
      "modules",
      "classes",
      "subclasses",
      "PDF",
    ],
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      siteName: SITE_CONFIG.name,
      title: SITE_CONFIG.name,
      description: SITE_CONFIG.tagline,
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: "Savage Library — D&D Content & Foundry Modules",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_CONFIG.name,
      description: SITE_CONFIG.tagline,
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#090B0F",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getAuthorizedUser();
  const connected =
    user?.provider === "patreon" ||
    Boolean(
      user &&
      !user.isAdmin &&
      (await hasLinkedPatreonAccount(user.id).catch(() => false)),
    );
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader
          patreonEnabled={patreonMemberConnectionsEnabled()}
          patreonConnected={connected}
        />
        <main id="main-content">{children}</main>
        <SiteFooter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": canonicalUrl("/#organization"),
                  name: SITE_CONFIG.name,
                  url: canonicalUrl("/"),
                  logo: canonicalUrl("/savage-library-logo.svg"),
                },
                {
                  "@type": "WebSite",
                  name: SITE_CONFIG.name,
                  url: canonicalUrl("/"),
                  publisher: { "@id": canonicalUrl("/#organization") },
                },
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
