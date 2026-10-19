"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import {
  isPublicAnalyticsPath,
  sanitizeAnalyticsEvent,
} from "../../lib/analytics";

function PublicPageViews() {
  const pathname = usePathname();
  const query = useSearchParams();
  if (!isPublicAnalyticsPath(pathname ?? "") || query?.has("preview"))
    return null;
  return (
    <Analytics
      beforeSend={sanitizeAnalyticsEvent}
      mode="production"
      debug={false}
    />
  );
}

export function PublicAnalytics() {
  return (
    <Suspense fallback={null}>
      <PublicPageViews />
    </Suspense>
  );
}
