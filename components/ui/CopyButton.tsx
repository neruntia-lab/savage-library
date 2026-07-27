"use client";

import { useState } from "react";

export function CopyButton({ value }: { value: string }) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("success");
      window.setTimeout(() => setStatus("idle"), 2_000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <button
      className="button button-secondary button-small"
      type="button"
      onClick={copy}
      aria-live="polite"
    >
      {status === "success"
        ? "Copied"
        : status === "error"
          ? "Copy failed"
          : "Copy manifest"}
    </button>
  );
}
