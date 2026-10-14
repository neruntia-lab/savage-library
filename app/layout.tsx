import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { SiteFooter } from "../components/layout/SiteFooter";
import { SiteHeader } from "../components/layout/SiteHeader";
import { SITE_CONFIG } from "../lib/config/site";
import { getAuthorizedUser } from "../lib/services/auth";
import { hasLinkedPatreonAccount } from "../lib/services/linked-patreon";
import { patreonMemberConnectionsEnabled } from "../lib/config/patreon-members";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await requestOrigin();
  const socialImage = `${origin}/og-fantasy.png`;
  return {
    metadataBase: new URL(origin),
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
          width: 1734,
          height: 907,
          alt: "Savage Library — The adventurer's digital archive",
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
      </body>
    </html>
  );
}

async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedHost =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const host =
    forwardedHost && /^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost)
      ? forwardedHost
      : null;
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "https" || forwardedProtocol === "http"
      ? forwardedProtocol
      : host?.startsWith("localhost")
        ? "http"
        : "https";
  return host
    ? `${protocol}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}
