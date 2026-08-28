import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ResourceCreationWizard } from "../../../../../components/admin/ResourceCreationWizard";
import { getAdminResource, getCatalogFacets } from "../../../../../lib/repositories/resource-repository";
import { requireAdminPage } from "../../../../../lib/services/auth";
import { listPatreonTiers } from "../../../../../lib/services/patreon";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Continue content setup", robots: { index: false, follow: false } };

export default async function ResourceSetupPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminPage())) redirect("/admin/login");
  const { id } = await params;
  const [resource, facets, tiers] = await Promise.all([
    getAdminResource(id).catch(() => null),
    getCatalogFacets(),
    listPatreonTiers().catch(() => []),
  ]);
  if (!resource) notFound();
  if (resource.setupStatus === "complete") redirect(`/admin/resources/${id}`);
  return <ResourceCreationWizard initialValue={resource} facets={facets} tiers={tiers} />;
}
