"use client";

import { useState } from "react";

export function SaveButton({ resourceId }: { resourceId: string }) {
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function toggleSaved() {
    setStatus("loading");
    const response = await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId, saved: !saved }),
    });

    if (response.status === 401) {
      window.location.assign("/account");
      return;
    }
    if (!response.ok) {
      setStatus("error");
      return;
    }
    setSaved(!saved);
    setStatus("idle");
  }

  return (
    <button
      className="button button-secondary"
      type="button"
      onClick={toggleSaved}
      disabled={status === "loading"}
      aria-pressed={saved}
    >
      {status === "loading"
        ? "Saving…"
        : status === "error"
          ? "Try again"
          : saved
            ? "Saved"
            : "Save resource"}
    </button>
  );
}
