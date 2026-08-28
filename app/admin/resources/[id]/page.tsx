import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ResourceWorkspace } from "../../../../components/admin/ResourceWorkspace";
import {
  getAdminResource,
  getCatalogFacets,
} from "../../../../lib/repositories/resource-repository";
import { requireAdminPage } from "../../../../lib/services/auth";
import { listPatreonTiers } from "../../../../lib/services/patreon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit content",
  robots: { index: false, follow: false },
};

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await requireAdminPage())) redirect("/admin/login");
  const { id } = await params;
  const [resource, facets, tiers] = await Promise.all([
    getAdminResource(id).catch(() => null),
    getCatalogFacets(),
    listPatreonTiers().catch(() => []),
  ]);
  if (!resource) notFound();
  if (resource.setupStatus === "in_progress") redirect(`/admin/resources/${id}/setup`);
  return <ResourceWorkspace initialValue={resource} facets={facets} tiers={tiers} />;
}
