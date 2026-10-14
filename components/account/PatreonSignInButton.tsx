"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

export function PatreonSignInButton({ returnTo }: { returnTo: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        className="button button-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await signIn("patreon", { callbackUrl: returnTo });
          } catch {
            setError("Could not connect to Patreon. Please try again.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Connecting…" : "Connect Patreon"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
