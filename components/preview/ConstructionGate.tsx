"use client";

import Image from "next/image";
import { useState } from "react";

export function ConstructionGate({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || !password || busy) return;

    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/preview-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setStatus(body.error ?? "Preview access could not be granted.");
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch {
      setStatus("Preview access is temporarily unavailable.");
      setBusy(false);
    }
  }

  return (
    <main className="construction-gate">
      <div className="construction-gate-glow" aria-hidden="true" />
      <section className="construction-card" aria-labelledby="construction-title">
        <div className="construction-sigil" aria-hidden="true">
          <Image
            src="/savage-library-logo.svg"
            alt=""
            width={105}
            height={142}
            priority
          />
        </div>
        <p className="eyebrow">Savage Library preview</p>
        <h1 id="construction-title">Site under construction</h1>
        <p className="construction-intro">Enter password to preview</p>

        {configured ? (
          <form className="construction-form" onSubmit={submit}>
            <label htmlFor="preview-password">Preview password</label>
            <input
              id="preview-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              required
              autoFocus
            />
            <button
              className="button button-primary"
              type="submit"
              disabled={busy || !password}
            >
              {busy ? "Opening the archive…" : "Enter the preview"}
            </button>
          </form>
        ) : (
          <p className="construction-unavailable">
            Preview access is temporarily unavailable.
          </p>
        )}
        <p className="construction-status" aria-live="polite">
          {status}
        </p>
      </section>
    </main>
  );
}
