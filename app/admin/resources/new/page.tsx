import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResourceWorkspace } from "../../../../components/admin/ResourceWorkspace";
import { EMPTY_RESOURCE } from "../../../../components/admin/types";
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
  const initialValue = {
    ...EMPTY_RESOURCE,
    categoryId: facets.categories[0]?.id ?? "",
    authorId: facets.authors[0]?.id ?? "",
    gameSystemId: facets.gameSystems[0]?.id ?? "",
  };
  return (
    <ResourceWorkspace initialValue={initialValue} facets={facets} tiers={tiers} />
  );
}
