import type { BeforeSendEvent } from "@vercel/analytics/next";
import { CANONICAL_SITE_ORIGIN } from "./config/site";

export function analyticsEnabled(environment: string | undefined): boolean {
  return environment === "production";
}

/** Only known public pages: never collect auth, admin, API, or unknown paths. */
export function isPublicAnalyticsPath(pathname: string): boolean {
  return /^(?:\/(?:library|wiki|legal|privacy|terms)?|\/(?:resources|categories|wiki)\/[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(
    pathname,
  );
}

export function sanitizeAnalyticsEvent(
  event: BeforeSendEvent,
): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;
  try {
    const url = new URL(event.url);
    if (
      url.origin !== CANONICAL_SITE_ORIGIN ||
      url.username ||
      url.password ||
      !isPublicAnalyticsPath(url.pathname) ||
      url.searchParams.has("preview")
    )
      return null;
    url.search = "";
    url.hash = "";
    return { type: "pageview", url: url.href };
  } catch {
    return null;
  }
}
