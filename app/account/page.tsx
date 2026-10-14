import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth";
import { EmailSignInForm } from "../../components/account/EmailSignInForm";
import { getAccountMembership } from "../../lib/repositories/membership-repository";
import { patreonMemberConnectionsEnabled } from "../../lib/config/patreon-members";
import { emailSignInEnabled } from "../../lib/config/email-sign-in";
import { PatreonSignInButton } from "../../components/account/PatreonSignInButton";
import { memberReturnPath } from "../../lib/config/member-navigation";
import { hasLinkedPatreonAccount } from "../../lib/services/linked-patreon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Member access",
  description:
    "Manage your Savage Library membership and complimentary access.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const query = await searchParams;
  const returnTo = memberReturnPath(query.returnTo);
  const connectionsEnabled = patreonMemberConnectionsEnabled();
  const emailEnabled = emailSignInEnabled();
  const session = await getServerSession(authOptions);
  const isPatron =
    session?.user?.provider === "patreon" ||
    Boolean(
      session?.user?.id &&
      session.user.role !== "admin" &&
      (await hasLinkedPatreonAccount(session.user.id).catch(() => false)),
    );
  const isAdmin = session?.user?.role === "admin";
  const signedIn = Boolean(session?.user?.id);
  const membership = session?.user?.id
    ? await getAccountMembership(session.user.id).catch(() => null)
    : null;

  return (
    <section className="section page-section">
      <div className="container narrow-container">
        <div className="account-panel patreon-account-panel">
          <p className="eyebrow">Member access</p>
          <h1>
            {isAdmin
              ? "Administrator account"
              : isPatron
                ? "Patreon connected"
                : signedIn
                  ? "Website membership"
                  : "Member sign in"}
          </h1>
          <p>
            {isAdmin
              ? "Administrator access does not require Patreon. Sign out before connecting a member account."
              : isPatron
                ? "Your current Savage Library membership is checked directly with Patreon whenever you request a protected download."
                : signedIn
                  ? "You are signed in with a verified email account. Any complimentary tiers granted by an administrator are applied to protected downloads."
                  : connectionsEnabled
                    ? emailEnabled
                      ? "Use Patreon for a paid membership or your email address for complimentary access granted by an administrator."
                      : "Connect your Patreon account to check your Savage Library membership."
                    : emailEnabled
                      ? "Use your email address for complimentary access granted by an administrator."
                      : "New member sign-ins are temporarily unavailable. Existing member sessions remain active."}
          </p>
          {!connectionsEnabled ? (
            <p role="status">
              New Patreon connections are temporarily unavailable. Existing
              memberships remain connected.
            </p>
          ) : null}
          <div className="profile-actions">
            {signedIn ? (
              <>
                <Link className="button button-primary" href="/library">
                  Browse the library
                </Link>
                {connectionsEnabled && !isAdmin ? (
                  <a
                    className="button button-secondary"
                    href={`/api/account/link-patreon?returnTo=${encodeURIComponent(returnTo)}`}
                  >
                    {isPatron ? "Reconnect Patreon" : "Link Patreon"}
                  </a>
                ) : null}
                <Link className="button button-secondary" href="/logout">
                  Disconnect
                </Link>
              </>
            ) : (
              <>
                {connectionsEnabled ? (
                  <PatreonSignInButton returnTo={returnTo} />
                ) : null}
                {emailEnabled ? (
                  <EmailSignInForm />
                ) : (
                  <p role="status">Email sign-in is temporarily unavailable.</p>
                )}
              </>
            )}
          </div>
          {query.error ? (
            <p role="alert">
              Patreon sign-in could not be completed. Please try again or use
              your existing account before linking Patreon.
            </p>
          ) : null}
          {signedIn ? (
            <div className="account-access-summary">
              <strong>
                Access source:{" "}
                {membership?.source ?? (isPatron ? "Patreon" : "none")}
              </strong>
              <span>
                Tiers:{" "}
                {membership?.tiers.length
                  ? membership.tiers.join(", ")
                  : "none currently verified"}
              </span>
              {membership?.expiresAt ? (
                <span>
                  Complimentary access expires{" "}
                  {new Date(membership.expiresAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          ) : null}
          <small>
            Access requires either a currently entitled Patreon tier or an
            active complimentary tier granted to this email account.
          </small>
        </div>
      </div>
    </section>
  );
}
