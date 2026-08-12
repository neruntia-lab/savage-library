import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth";
import { LogoutActions } from "../../components/account/LogoutActions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign out",
  robots: { index: false, follow: false },
};

export default async function LogoutPage() {
  const session = await getServerSession(authOptions);
  const signedIn = Boolean(session?.user?.id);

  return (
    <section className="section page-section">
      <div className="container narrow-container">
        <div className="account-panel logout-panel">
          <p className="eyebrow">Account security</p>
          <h1>{signedIn ? "Sign out of Savage Library?" : "You are signed out"}</h1>
          <p>
            {signedIn
              ? `This will end the current session${session?.user?.name ? ` for ${session.user.name}` : ""}.`
              : "There is no active Savage Library session in this browser."}
          </p>
          <LogoutActions
            signedIn={signedIn}
            cancelHref={session?.user?.role === "admin" ? "/admin" : "/account"}
          />
        </div>
      </div>
    </section>
  );
}
