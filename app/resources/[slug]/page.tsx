import { ResourcePresentation } from "../../../components/resources/ResourcePresentation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { NextRequest } from "next/server";
import { foundryManifestUrl } from "../../../lib/config/site";
import { getResourceBySlug, getResourcePreview } from "../../../lib/repositories/resource-repository";
import { getAuthorizedUser, requireAdminPage } from "../../../lib/services/auth";
import { resolveEntitlement } from "../../../lib/services/entitlements";

export const dynamic = "force-dynamic";

type ResourcePageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lang?: string; patreon?: string; preview?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: ResourcePageProps): Promise<Metadata> {
  const query = await searchParams;
  if (query?.preview) {
    return { title: "Draft preview", robots: { index: false, follow: false } };
  }
  const { slug } = await params;
  const resource = await getResourceBySlug(slug);
  return resource
    ? {
        title: resource.title,
        description: resource.shortDescription,
        openGraph: {
          title: resource.title,
          description: resource.shortDescription,
          type: "article",
        },
      }
    : {};
}

export default async function ResourcePage({
  params,
  searchParams,
}: ResourcePageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const locale = query?.lang === "es" ? "es" : "en";
  const previewId = query?.preview;
  if (previewId && !(await requireAdminPage())) notFound();
  const resource = previewId
    ? await getResourcePreview(previewId, locale)
    : await getResourceBySlug(slug, locale);
  if (!resource) notFound();
  if (previewId && resource.slug !== slug) notFound();
  const isPreview = Boolean(previewId);
  const user =
    resource.accessMode === "patreon" && !isPreview ? await getAuthorizedUser() : null;
  const requiredTierIds = resource.allowedPatreonTiers?.map((tier) => tier.id) ?? [];
  const entitlement =
    resource.accessMode === "patreon" && !isPreview
      ? await (async () => {
          const requestHeaders = await headers();
          return resolveEntitlement({
          user,
          request: new NextRequest("https://savage-library.local/resource", {
            headers: requestHeaders,
          }),
          requiredTierIds,
          allowAnyPaidTier: requiredTierIds.length === 0,
          });
        })()
      : null;
  const isPublic = resource.accessMode !== "patreon";
  const canAccessDownloads =
    isPreview || isPublic || Boolean(entitlement?.entitled);
  const isModule = resource.resourceType === "module";
  const publicManifestUrl =
    isModule && isPublic
      ? foundryManifestUrl(resource.slug)
      : null;
  return <ResourcePresentation resource={resource} isPreview={isPreview} previewId={previewId} user={user}
    entitled={Boolean(entitlement?.entitled)} canAccessDownloads={canAccessDownloads} isModule={isModule}
    isPublic={isPublic} publicManifestUrl={publicManifestUrl} patreonRequired={query?.patreon === "required"} />;
}
