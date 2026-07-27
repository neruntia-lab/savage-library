import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Patreon access",
  description: "Connect Patreon to unlock member-only Savage Library downloads.",
};

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const isPatron = session?.user?.provider === "patreon";

  return (
    <section className="section page-section">
      <div className="container narrow-container">
        <div className="account-panel patreon-account-panel">
          <p className="eyebrow">Member access</p>
          <h1>{isPatron ? "Patreon connected" : "Connect your Patreon"}</h1>
          <p>
            {isPatron
              ? "Your current Savage Library membership is checked directly with Patreon whenever you request a protected download."
              : "Sign in with Patreon to unlock resources included with your active Savage Library tier. No public profile or account dashboard is created."}
          </p>
          <div className="profile-actions">
            {isPatron ? (
              <>
                <Link className="button button-primary" href="/library">
                  Browse the library
                </Link>
                <Link
                  className="button button-secondary"
                  href="/api/auth/signout?callbackUrl=/"
                >
                  Disconnect
                </Link>
              </>
            ) : (
              <Link
                className="button button-primary"
                href="/api/auth/signin/patreon?callbackUrl=/library"
              >
                Sign in with Patreon
              </Link>
            )}
          </div>
          <small>
            Access is granted only when Patreon reports a currently entitled
            qualifying tier.
          </small>
        </div>
      </div>
    </section>
  );
}
