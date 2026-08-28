import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResourceCreationWizard } from "../../../../components/admin/ResourceCreationWizard";
import { getCatalogFacets } from "../../../../lib/repositories/resource-repository";
import { requireAdminPage } from "../../../../lib/services/auth";
import { listPatreonTiers } from "../../../../lib/services/patreon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add content",
  robots: { index: false, follow: false },
};

export default async function NewResourcePage() {
  if (!(await requireAdminPage())) redirect("/admin/login");
  const facets = await getCatalogFacets();
  const tiers = await listPatreonTiers().catch(() => []);
  return <ResourceCreationWizard facets={facets} tiers={tiers} />;
}
