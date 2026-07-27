"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("Opening the archive…");
    const result = await signIn("admin-password", {
      password,
      callbackUrl: "/admin",
      redirect: false,
    });

    if (result?.ok) {
      window.location.assign(result.url ?? "/admin");
      return;
    }

    setBusy(false);
    setStatus("That password was not accepted.");
  }

  return (
    <form className="admin-login-form" onSubmit={submit}>
      <label>
        <span>Administrator password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          autoFocus
        />
      </label>
      <button className="button button-primary" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Enter the dashboard"}
      </button>
      <p className="admin-login-status" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
