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
          await signOut({ callbackUrl: "/" });
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
