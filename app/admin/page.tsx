import type { Metadata } from "next";
import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import { AdminDashboard } from "../../components/admin/AdminDashboard";
import { ROUTES } from "../../lib/config/site";
import {
  getCatalogFacets,
  listAdminResources,
} from "../../lib/repositories/resource-repository";
import { getAuthorizedUser } from "../../lib/services/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  await requireChatGPTUser(ROUTES.admin);
  const user = await getAuthorizedUser();

  if (!user?.isAdmin) {
    return (
      <section className="section">
        <div className="container narrow-container">
          <div className="error-state">
            <p className="eyebrow">Access denied</p>
            <h1>Administrator access is required.</h1>
            <p>
              Your account is signed in but is not on the Savage Library admin
              allowlist.
            </p>
            <a
              className="button button-secondary"
              href={chatGPTSignOutPath("/")}
            >
              Sign out
            </a>
          </div>
        </div>
      </section>
    );
  }

  const [resources, facets] = await Promise.all([
    listAdminResources(),
    getCatalogFacets(),
  ]);

  return (
    <section className="section page-section">
      <div className="container">
        <div className="page-heading">
          <p className="eyebrow">Content management</p>
          <h1>Admin dashboard</h1>
          <p>
            Manage resources, releases, compatibility, files, metadata, and
            publishing.
          </p>
        </div>
        <AdminDashboard initialResources={resources} facets={facets} />
      </div>
    </section>
  );
}
