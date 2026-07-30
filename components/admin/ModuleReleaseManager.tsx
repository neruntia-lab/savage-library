"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

type Release = {
  id: string;
  version: string;
  status: string;
  foundryMinimum: string | null;
  foundryVerified: string | null;
  foundryMaximum: string | null;
  checksum: string | null;
  size: number | null;
  source: string;
  errors: string;
  summary: string;
  details: string;
  releasedAt: string;
  publishedAt: string | null;
  isCurrent: boolean;
};

export function ModuleReleaseManager({
  resourceId,
  accessMode,
}: {
  resourceId: string;
  accessMode: "public" | "patreon";
}) {
  const router = useRouter();
  const [releases, setReleases] = useState<Release[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [publisherToken, setPublisherToken] = useState("");

  async function refresh() {
    const response = await fetch(`/api/admin/resources/${resourceId}/releases`);
    const body = (await response.json()) as { releases?: Release[]; error?: string };
    if (!response.ok) {
      setStatus(body.error ?? "Releases could not be loaded.");
      return;
    }
    setReleases(body.releases ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/resources/${resourceId}/releases`)
      .then(async (response) => ({
        ok: response.ok,
        body: (await response.json()) as { releases?: Release[]; error?: string },
      }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) setStatus(body.error ?? "Releases could not be loaded.");
        else setReleases(body.releases ?? []);
      })
      .catch(() => {
        if (!cancelled) setStatus("Releases could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  async function uploadRelease(file: File) {
    setBusy(true);
    setStatus(`Validating and uploading ${file.name}…`);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
      await upload(
        `foundry-release-uploads/${resourceId}/${Date.now()}-${safeName}`,
        file,
        {
          access: "private",
          handleUploadUrl: "/api/publisher/uploads",
          multipart: file.size > 20 * 1024 * 1024,
          clientPayload: JSON.stringify({
            resourceId,
            originalName: file.name,
            sizeBytes: file.size,
            source: "admin",
            uploadedBy: "admin",
          }),
        },
      );
      setStatus("Release uploaded. Validation may take a moment.");
      await refresh();
      window.setTimeout(() => void refresh(), 2_000);
      window.setTimeout(() => void refresh(), 5_000);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function action(releaseId: string, actionName: "publish" | "reject" | "rollback") {
    setBusy(true);
    const response = await fetch(
      `/api/admin/resources/${resourceId}/releases/${releaseId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName }),
      },
    );
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setStatus(response.ok ? `Release ${actionName} completed.` : body.error ?? "Release update failed.");
    if (response.ok) {
      await refresh();
      router.refresh();
    }
  }

  async function saveDraft(release: Release) {
    setBusy(true);
    const response = await fetch(
      `/api/admin/resources/${resourceId}/releases/${release.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(release),
      },
    );
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setStatus(response.ok ? "Draft metadata saved." : body.error ?? "Draft could not be saved.");
    if (response.ok) await refresh();
  }

  async function rotateToken() {
    setBusy(true);
    const response = await fetch(`/api/admin/resources/${resourceId}/publisher-token`, {
      method: "POST",
    });
    const body = (await response.json()) as { token?: string; error?: string };
    setBusy(false);
    if (!response.ok || !body.token) {
      setStatus(body.error ?? "Publisher token could not be created.");
      return;
    }
    setPublisherToken(body.token);
    setStatus("New CLI token created. Copy it now.");
  }

  return (
    <section
      className="admin-editor-section"
      id="module-releases"
      onChange={(event) => event.stopPropagation()}
    >
      <div className="admin-section-heading">
        <p className="eyebrow">Foundry publisher</p>
        <h2>Module releases</h2>
        <p>Upload a ZIP as a draft, review its manifest, then explicitly publish it.</p>
      </div>
      {accessMode === "patreon" ? (
        <div className="admin-callout">
          Paid module releases remain website-only. Public Foundry manifests are disabled.
        </div>
      ) : null}
      <div className="publisher-toolbar">
        <label className="button button-primary">
          {busy ? "Working…" : "Upload release ZIP"}
          <input
            type="file"
            accept=".zip"
            hidden
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void uploadRelease(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => void rotateToken()}>
          Rotate CLI token
        </button>
      </div>
      {publisherToken ? (
        <div className="publisher-token">
          <strong>Copy this token now; it will not be shown again.</strong>
          <code>{publisherToken}</code>
        </div>
      ) : null}
      <p className="publisher-status" aria-live="polite">{status}</p>
      <div className="publisher-release-list">
        {releases.map((release, index) => (
          <article className="publisher-release-card" key={release.id}>
            <header>
              <div>
                <strong>v{release.version}</strong>
                <span className={`release-state release-state-${release.status}`}>
                  {release.status}{release.isCurrent ? " · active" : ""}
                </span>
              </div>
              <small>{release.source} · {formatBytes(release.size ?? 0)}</small>
            </header>
            {release.status === "failed" ? (
              <ul className="publisher-errors">
                {parseErrors(release.errors).map((error) => <li key={error}>{error}</li>)}
              </ul>
            ) : null}
            {release.status === "draft" ? (
              <>
                <div className="form-grid form-grid-three">
                  <label><span>Minimum</span><input value={release.foundryMinimum ?? ""} onChange={(event) => update(index, "foundryMinimum", event.target.value, setReleases)} /></label>
                  <label><span>Verified</span><input value={release.foundryVerified ?? ""} onChange={(event) => update(index, "foundryVerified", event.target.value, setReleases)} /></label>
                  <label><span>Maximum</span><input value={release.foundryMaximum ?? ""} onChange={(event) => update(index, "foundryMaximum", event.target.value, setReleases)} /></label>
                </div>
                <label><span>Changelog summary</span><input value={release.summary} onChange={(event) => update(index, "summary", event.target.value, setReleases)} /></label>
                <label><span>Changelog details</span><textarea className="textarea-compact" value={release.details} onChange={(event) => update(index, "details", event.target.value, setReleases)} /></label>
              </>
            ) : null}
            <footer>
              {release.checksum ? <code title={release.checksum}>SHA-256 {release.checksum.slice(0, 12)}…</code> : <span />}
              <div>
                {release.status === "failed" ? (
                  <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => void action(release.id, "reject")}>Reject</button>
                ) : null}
                {release.status === "draft" ? (
                  <>
                    <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => void saveDraft(release)}>Save review</button>
                    <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => void action(release.id, "reject")}>Reject</button>
                    <button type="button" className="button button-primary button-small" disabled={busy || accessMode !== "public"} onClick={() => void action(release.id, "publish")}>Publish</button>
                  </>
                ) : null}
                {release.status === "superseded" ? (
                  <button type="button" className="button button-secondary button-small" disabled={busy || accessMode !== "public"} onClick={() => void action(release.id, "rollback")}>Roll back</button>
                ) : null}
              </div>
            </footer>
          </article>
        ))}
        {!releases.length ? <div className="admin-callout">No module releases have been uploaded yet.</div> : null}
      </div>
    </section>
  );
}

function update(index: number, field: keyof Release, value: string, setter: React.Dispatch<React.SetStateAction<Release[]>>) {
  setter((current) => current.map((release, itemIndex) => itemIndex === index ? { ...release, [field]: value } : release));
}

function parseErrors(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
