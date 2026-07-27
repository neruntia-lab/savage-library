"use client";

import { useState } from "react";

export function ProfileForm({
  email,
  displayName,
}: {
  email: string;
  displayName: string | null;
}) {
  const [status, setStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  async function submit(formData: FormData) {
    setStatus("saving");
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: formData.get("displayName") }),
    });
    setStatus(response.ok ? "success" : "error");
  }

  return (
    <form className="profile-form" action={submit}>
      <label>
        <span>Display name</span>
        <input
          name="displayName"
          defaultValue={displayName ?? ""}
          minLength={2}
          maxLength={80}
          required
        />
      </label>
      <label>
        <span>Email</span>
        <input value={email} readOnly disabled />
      </label>
      <div className="profile-actions">
        <button
          className="button button-primary"
          type="submit"
          disabled={status === "saving"}
        >
          {status === "saving" ? "Saving…" : "Save profile"}
        </button>
        <span className={`form-status form-status-${status}`} aria-live="polite">
          {status === "success"
            ? "Profile saved."
            : status === "error"
              ? "Could not save profile."
              : ""}
        </span>
      </div>
    </form>
  );
}
