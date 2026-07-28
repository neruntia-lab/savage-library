import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth";
import { EmailSignInForm } from "../../components/account/EmailSignInForm";
import { getAccountMembership } from "../../lib/repositories/membership-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Member access",
  description: "Connect Patreon or use complimentary Savage Library access.",
};

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const isPatron = session?.user?.provider === "patreon";
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
            {isPatron
              ? "Patreon connected"
              : signedIn
                ? "Website membership"
                : "Member sign in"}
          </h1>
          <p>
            {isPatron
              ? "Your current Savage Library membership is checked directly with Patreon whenever you request a protected download."
              : signedIn
                ? "You are signed in with a verified email account. Any complimentary tiers granted by an administrator are applied to protected downloads."
                : "Use Patreon for a paid membership or your email address for complimentary access granted by an administrator."}
          </p>
          <div className="profile-actions">
            {signedIn ? (
              <>
                <Link className="button button-primary" href="/library">
                  Browse the library
                </Link>
                <Link
                  className="button button-secondary"
                  href="/api/account/link-patreon"
                >
                  Link Patreon
                </Link>
                <Link
                  className="button button-secondary"
                  href="/api/auth/signout?callbackUrl=/"
                >
                  Disconnect
                </Link>
              </>
            ) : (
              <>
                <Link
                  className="button button-primary"
                  href="/api/auth/signin/patreon?callbackUrl=/account"
                >
                  Sign in with Patreon
                </Link>
                <EmailSignInForm />
              </>
            )}
          </div>
          {signedIn ? (
            <div className="account-access-summary">
              <strong>
                Access source: {membership?.source ?? (isPatron ? "Patreon" : "none")}
              </strong>
              <span>
                Tiers: {membership?.tiers.length ? membership.tiers.join(", ") : "none currently verified"}
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
