import type { Metadata } from "next";
import Link from "next/link";
import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import { ProfileForm } from "../../components/account/ProfileForm";
import { ResourceGrid } from "../../components/resources/ResourceGrid";
import { ROUTES } from "../../lib/config/site";
import { formatDate } from "../../lib/format";
import { getAccountOverview } from "../../lib/repositories/account-repository";
import { getAuthorizedUser } from "../../lib/services/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your account",
  description: "Saved resources, download history, and profile settings.",
};

export default async function AccountPage() {
  await requireChatGPTUser(ROUTES.account);
  const user = await getAuthorizedUser();
  if (!user) return null;

  const overview = await getAccountOverview(user);

  return (
    <section className="section page-section">
      <div className="container">
        <div className="account-heading">
          <div className="page-heading">
            <p className="eyebrow">Personal library</p>
            <h1>Your account</h1>
            <p>Saved resources, download history, and profile settings.</p>
          </div>
          <Link
            className="button button-secondary button-small"
            href={chatGPTSignOutPath("/")}
          >
            Sign out
          </Link>
        </div>

        <div className="account-section">
          <div className="section-heading">
            <h2>Saved resources</h2>
            <span>{overview.saved.length} saved</span>
          </div>
          <ResourceGrid
            resources={overview.saved.map(({ resource }) => resource)}
          />
        </div>

        <div className="account-grid">
          <section className="account-panel" aria-labelledby="history-title">
            <h2 id="history-title">Download history</h2>
            {overview.history.length ? (
              <div className="history-list">
                {overview.history.map((entry) => (
                  <div key={entry.id}>
                    <div>
                      <Link href={ROUTES.resource(entry.resourceSlug)}>
                        {entry.resourceTitle}
                      </Link>
                      <span>{entry.fileName}</span>
                    </div>
                    <time dateTime={entry.downloadedAt}>
                      {formatDate(entry.downloadedAt)}
                    </time>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-empty">No downloads yet.</p>
            )}
          </section>

          <section className="account-panel" aria-labelledby="profile-title">
            <h2 id="profile-title">Profile settings</h2>
            <ProfileForm
              email={overview.profile.email}
              displayName={overview.profile.displayName}
            />
          </section>
        </div>
      </div>
    </section>
  );
}
