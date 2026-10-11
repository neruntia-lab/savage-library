"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export function LogoutActions({
  signedIn,
  cancelHref,
}: {
  signedIn: boolean;
  cancelHref: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!signedIn) {
    return (
      <Link className="button button-primary" href="/">
        Return home
      </Link>
    );
  }

  return (
    <div className="logout-actions">
      <Link className="button button-secondary" href={cancelHref}>
        Cancel
      </Link>
      <button
        className="button button-primary"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await signOut({ callbackUrl: "/" });
          } catch {
            setError("Sign out could not complete. Please retry.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
