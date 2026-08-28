"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

const SIGN_IN_TIMEOUT_MS = 15_000;

export function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("Opening the archive…");
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const result = await Promise.race([
        signIn("admin-password", {
          password,
          callbackUrl: "/admin",
          redirect: false,
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("sign-in-timeout")),
            SIGN_IN_TIMEOUT_MS,
          );
        }),
      ]);

      if (result?.ok) {
        window.location.assign(result.url ?? "/admin");
        return;
      }

      if (result?.status === 429 || result?.error === "RateLimited") {
        setStatus("Too many attempts. Wait a few minutes and try again.");
      } else if (result && result.status >= 500) {
        setStatus("The sign-in service is unavailable. Please try again.");
      } else {
        setStatus("That password was not accepted.");
      }
    } catch (error) {
      setStatus(
        error instanceof Error && error.message === "sign-in-timeout"
          ? "Sign-in took too long. Check your connection and try again."
          : "The sign-in request failed. Check your connection and try again.",
      );
    } finally {
      if (timeout) clearTimeout(timeout);
      setBusy(false);
    }
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
