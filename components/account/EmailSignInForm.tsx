"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function EmailSignInForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="email-signin-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        await signIn("email", { email, callbackUrl: "/account" });
        setBusy(false);
      }}
    >
      <label>
        <span>Email address</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <button className="button button-primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
