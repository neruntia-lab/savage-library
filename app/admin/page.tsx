import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminDashboard } from "../../components/admin/AdminDashboard";
import {
  getCatalogFacets,
  listAdminResources,
} from "../../lib/repositories/resource-repository";
import { getSiteAppearance } from "../../lib/repositories/site-settings-repository";
import { requireAdminPage } from "../../lib/services/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const user = await requireAdminPage();
  if (!user) redirect("/admin/login");

  const [resources, facets, appearance] = await Promise.all([
    listAdminResources(),
    getCatalogFacets(),
    getSiteAppearance(),
  ]);

  return (
    <section className="section page-section">
      <div className="container">
        <div className="admin-page-heading">
          <div className="page-heading">
            <p className="eyebrow">Keeper console</p>
            <h1>Library dashboard</h1>
            <p>
              Create, translate, release, protect, and publish every entry in
              the archive.
            </p>
          </div>
          <Link
            className="button button-secondary button-small"
            href="/logout"
          >
            Sign out
          </Link>
        </div>
        <AdminDashboard
          initialResources={resources}
          facets={facets}
          initialAppearance={appearance}
        />
      </div>
    </section>
  );
}
