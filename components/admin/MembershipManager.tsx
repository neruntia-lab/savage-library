"use client";

import { useEffect, useMemo, useState } from "react";

type Tier = { id: string; title: string; amountCents: number };
type Member = { id: string; displayName: string; isActive: boolean; tierIds: string[]; source: "patreon" };
type Grant = { id: string; displayName: string; email: string; status: string; tierIds: string[]; expiresAt: string | null; source: "complimentary" };
type CandidatePayload = {
  resourceKey?: string; title: string; description: string; shortDescription: string;
  resourceType?: "module" | "pdf" | "macro"; version: string; manifestUrl?: string;
  projectUrl?: string; foundryMinimum?: string; foundryVerified?: string;
  foundryMaximum?: string; tags: string[];
};
type Candidate = {
  id: string; title: string; reviewStatus: string; confidence: number;
  resourceId: string | null; matchedBy: string | null; lastSyncedAt: string;
  payload: CandidatePayload; warnings: string[];
  matchedResource: {
    id: string; title: string; resourceType: string; currentVersion: string;
    manifestUrl: string | null; projectUrl: string | null; shortDescription: string;
  } | null;
  links: Array<{ id: string; label: string; role: string; destination: string }>;
};
type AdminResource = { id: string; title: string; slug: string };

export function MembershipManager({ onStatus }: { onStatus: (message: string) => void }) {
  const [data, setData] = useState<{ tiers: Tier[]; members: Member[]; grants: Grant[] }>({ tiers: [], members: [], grants: [] });
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [resources, setResources] = useState<AdminResource[]>([]);
  const [candidateFilter, setCandidateFilter] = useState("all");

  async function load() {
    const [response, candidateResponse, resourceResponse] = await Promise.all([
      fetch("/api/admin/memberships"),
      fetch("/api/admin/patreon/posts"),
      fetch("/api/resources?admin=1"),
    ]);
    if (response.ok) setData(await response.json());
    if (candidateResponse.ok) setCandidates((await candidateResponse.json()).candidates);
    if (resourceResponse.ok) setResources((await resourceResponse.json()).resources);
  }
  // The initial membership roster is an external API snapshot.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => [...data.members, ...data.grants].filter((row) => {
    const text = row.source === "complimentary" ? `${row.displayName} ${row.email}` : row.displayName;
    if (query.trim() && !text.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (filter === "patreon" || filter === "complimentary") return row.source === filter;
    if (filter === "active") return row.source === "patreon" ? row.isActive : row.status === "active";
    if (filter === "inactive") return row.source === "patreon" ? !row.isActive : row.status !== "active";
    if (filter === "expired") return row.source === "complimentary" && row.status === "expired";
    if (filter === "replaced") return row.source === "complimentary" && row.status === "replaced";
    return true;
  }), [data, filter, query]);

  async function createGrant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    setBusy(true);
    const response = await fetch("/api/admin/memberships", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"), tierIds: form.getAll("tierIds"),
        expiresAt: form.get("expiresAt") || null, reason: form.get("reason"),
        internalNote: form.get("internalNote"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    onStatus(response.ok ? "Complimentary access granted." : body.error ?? "Grant failed.");
    if (response.ok) { target.reset(); await load(); }
    setBusy(false);
  }

  async function revoke(id: string) {
    const response = await fetch(`/api/admin/memberships/${id}`, { method: "DELETE" });
    onStatus(response.ok ? "Complimentary access revoked." : "Grant could not be revoked.");
    if (response.ok) await load();
  }

  async function resend(id: string) {
    const response = await fetch(`/api/admin/memberships/${id}`, { method: "POST" });
    onStatus(response.ok ? "A new sign-in link was sent." : "The sign-in email could not be sent.");
  }

  async function synchronize() {
    setBusy(true);
    onStatus("Synchronizing Patreon members, tiers, and import candidates…");
    const response = await fetch("/api/admin/patreon/sync", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    onStatus(response.ok ? `${body.memberCount} members and ${body.postCount} candidates synchronized.` : body.error ?? "Synchronization failed.");
    if (response.ok) await load();
    setBusy(false);
  }

  async function connectCreator() {
    setBusy(true);
    onStatus("Validating creator credentials and registering the webhook…");
    const response = await fetch("/api/admin/patreon/setup", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    onStatus(response.ok ? `Patreon connected. ${body.memberCount} members and ${body.postCount} candidates synchronized.` : body.error ?? "Patreon creator setup failed.");
    if (response.ok) await load();
    setBusy(false);
  }

  async function updateCandidate(candidate: Candidate, action: "save" | "approve" | "reject" | "reprocess", payload = candidate.payload, resourceId = candidate.resourceId) {
    setBusy(true);
    const response = await fetch("/api/admin/patreon/posts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: candidate.id, action, ...(action === "reprocess" ? {} : { payload, resourceId }) }),
    });
    const body = await response.json().catch(() => ({}));
    onStatus(response.ok
      ? action === "approve" ? "Candidate approved as an unpublished catalog resource." : `Candidate ${action === "reprocess" ? "reprocessed" : action === "reject" ? "rejected" : "saved"}.`
      : body.error ?? "Candidate update failed.");
    if (response.ok) await load();
    setBusy(false);
  }

  return <div className="membership-admin">
    <div className="admin-stats">
      <div><span>Patreon members</span><strong>{data.members.filter((member) => member.isActive).length}</strong><small>active</small></div>
      <div><span>Complimentary</span><strong>{data.grants.filter((grant) => grant.status === "active").length}</strong><small>active grants</small></div>
      {data.tiers.filter((tier) => tier.amountCents > 0).slice(0, 2).map((tier) =>
        <div key={tier.id}><span>{tier.title}</span><strong>{[...data.members, ...data.grants].filter((row) => row.tierIds.includes(tier.id)).length}</strong><small>assigned</small></div>)}
    </div>
    <section className="admin-panel patreon-settings">
      <div><p className="eyebrow">Campaign connection</p><h2>Patreon synchronization</h2><p>Refresh tiers, subscribers, and reviewable catalog imports.</p></div>
      <div className="profile-actions">
        <button className="button button-secondary" onClick={connectCreator} disabled={busy}>Connect creator account</button>
        <button className="button button-primary" onClick={synchronize} disabled={busy}>{busy ? "Working…" : "Synchronize Patreon"}</button>
      </div>
    </section>
    <section className="admin-panel">
      <h2>Grant complimentary access</h2>
      <form className="grant-form" onSubmit={createGrant}>
        <input name="email" type="email" required placeholder="member@example.com" />
        <input name="expiresAt" type="datetime-local" aria-label="Optional expiration" />
        <input name="reason" placeholder="Reason" /><input name="internalNote" placeholder="Internal note" />
        <fieldset><legend>Equivalent paid tiers</legend>{data.tiers.filter((tier) => tier.amountCents > 0).map((tier) =>
          <label key={tier.id}><input type="checkbox" name="tierIds" value={tier.id} />{tier.title}</label>)}</fieldset>
        <button className="button button-primary" disabled={busy}>Grant access</button>
      </form>
    </section>
    <section className="admin-panel">
      <div className="admin-filter-bar">
        <input type="search" placeholder="Search members…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All members</option><option value="patreon">Patreon</option><option value="complimentary">Complimentary</option>
          <option value="active">Active</option><option value="inactive">Inactive / expired</option><option value="expired">Expired grants</option><option value="replaced">Replaced by Patreon</option>
        </select>
      </div>
      <div className="admin-data-table-wrap">
        <table className="admin-data-table membership-table">
          <thead><tr><th>Member</th><th>Source and status</th><th>Effective tiers</th><th>Actions</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={`${row.source}-${row.id}`}>
            <td data-label="Member"><strong>{row.displayName}</strong>{row.source === "complimentary" ? <small>{row.email}</small> : null}</td>
            <td data-label="Source and status"><span className={`admin-status-pill ${row.source === "patreon" ? "patreon" : row.status}`}>{row.source === "patreon" ? `Patreon · ${row.isActive ? "active" : "inactive"}` : `Complimentary · ${row.status}`}</span></td>
            <td data-label="Effective tiers">{row.tierIds.map((id) => data.tiers.find((tier) => tier.id === id)?.title ?? id).join(", ") || "No tier"}</td>
            <td data-label="Actions"><div className="admin-row-actions">{row.source === "complimentary" && row.status === "active" ? <><button className="button button-secondary button-small" onClick={() => resend(row.id)}>Resend link</button><button className="button button-danger button-small" onClick={() => revoke(row.id)}>Revoke</button></> : <span className="admin-table-empty">—</span>}</div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    <section className="admin-panel">
      <div className="admin-filter-bar">
        <div><p className="eyebrow">Catalog ingestion</p><h2>Patreon import candidates</h2></div>
        <select value={candidateFilter} onChange={(event) => setCandidateFilter(event.target.value)}>
          <option value="all">All candidates</option><option value="pending">Pending</option><option value="needs_review">Needs review</option>
          <option value="approved">Approved</option><option value="rejected">Rejected</option><option value="source_deleted">Source deleted</option>
          <option value="module">Modules</option><option value="pdf">PDFs</option><option value="macro">Macros</option>
        </select>
      </div>
      <div className="candidate-list">{candidates
        .filter((candidate) => candidateFilter === "all" || candidate.reviewStatus === candidateFilter || candidate.payload.resourceType === candidateFilter)
        .map((candidate) => <CandidateEditor key={candidate.id} candidate={candidate} resources={resources} busy={busy} onAction={updateCandidate} />)}
      </div>
    </section>
  </div>;
}

function CandidateEditor({ candidate, resources, busy, onAction }: {
  candidate: Candidate; resources: AdminResource[]; busy: boolean;
  onAction: (candidate: Candidate, action: "save" | "approve" | "reject" | "reprocess", payload?: CandidatePayload, resourceId?: string | null) => Promise<void>;
}) {
  const [payload, setPayload] = useState(candidate.payload);
  const [resourceId, setResourceId] = useState(candidate.resourceId ?? "");
  function field<K extends keyof CandidatePayload>(key: K, value: CandidatePayload[K]) {
    setPayload((current) => ({ ...current, [key]: value }));
  }
  return <article className="candidate-card">
    <div className="candidate-heading">
      <div><strong>{candidate.title}</strong><small>{candidate.reviewStatus.replaceAll("_", " ")} · confidence {candidate.confidence}% · synced {new Date(candidate.lastSyncedAt).toLocaleString()}</small></div>
      <span className={`admin-status-pill ${candidate.reviewStatus}`}>{candidate.reviewStatus.replaceAll("_", " ")}</span>
    </div>
    {candidate.warnings.length ? <ul className="candidate-warnings">{candidate.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
    <div className="candidate-fields">
      <label>Type<select value={payload.resourceType ?? ""} onChange={(event) => field("resourceType", event.target.value as CandidatePayload["resourceType"])}><option value="">Choose type</option><option value="module">Module</option><option value="pdf">PDF</option><option value="macro">Macro</option></select></label>
      <label>Resource key<input value={payload.resourceKey ?? ""} onChange={(event) => field("resourceKey", event.target.value)} /></label>
      <label>Title<input value={payload.title} onChange={(event) => field("title", event.target.value)} /></label>
      <label>Version<input value={payload.version} onChange={(event) => field("version", event.target.value)} /></label>
      <label>Short description<input value={payload.shortDescription} onChange={(event) => field("shortDescription", event.target.value)} /></label>
      <label>Foundry minimum<input value={payload.foundryMinimum ?? ""} onChange={(event) => field("foundryMinimum", event.target.value || undefined)} /></label>
      <label>Foundry verified<input value={payload.foundryVerified ?? ""} onChange={(event) => field("foundryVerified", event.target.value || undefined)} /></label>
      <label>Foundry maximum<input value={payload.foundryMaximum ?? ""} onChange={(event) => field("foundryMaximum", event.target.value || undefined)} /></label>
      <label>Manifest URL<input type="url" value={payload.manifestUrl ?? ""} onChange={(event) => field("manifestUrl", event.target.value || undefined)} /></label>
      <label>Project URL<input type="url" value={payload.projectUrl ?? ""} onChange={(event) => field("projectUrl", event.target.value || undefined)} /></label>
      <label>Existing resource<select value={resourceId} onChange={(event) => setResourceId(event.target.value)}><option value="">Create a new resource</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.title} ({resource.slug})</option>)}</select></label>
      <label>Tags<input value={payload.tags.join(", ")} onChange={(event) => field("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} /></label>
      <label className="candidate-description">Description<textarea rows={6} value={payload.description} onChange={(event) => field("description", event.target.value)} /></label>
    </div>
    {candidate.matchedResource ? <div className="candidate-comparison">
      <strong>Proposed update · matched by {candidate.matchedBy?.replaceAll("_", " ") ?? "administrator"}</strong>
      <span>Title: {candidate.matchedResource.title} → {payload.title}</span>
      <span>Type: {candidate.matchedResource.resourceType} → {payload.resourceType}</span>
      <span>Version: {candidate.matchedResource.currentVersion} → {payload.version}</span>
      <span>Manifest: {candidate.matchedResource.manifestUrl ?? "none"} → {payload.manifestUrl ?? "none"}</span>
    </div> : null}
    {candidate.links.length ? <div className="candidate-links"><strong>Protected links</strong>{candidate.links.map((link) => <span key={link.id}>{link.role}: {link.label} — {link.destination}</span>)}</div> : null}
    <div className="profile-actions">
      <button className="button button-secondary button-small" disabled={busy} onClick={() => onAction(candidate, "reprocess")}>Reprocess</button>
      <button className="button button-secondary button-small" disabled={busy} onClick={() => onAction(candidate, "save", payload, resourceId || null)}>Save draft</button>
      <button className="button button-secondary button-small" disabled={busy} onClick={() => onAction(candidate, "reject", payload, resourceId || null)}>Reject</button>
      <button className="button button-primary button-small" disabled={busy || !payload.resourceType} onClick={() => onAction(candidate, "approve", payload, resourceId || null)}>Approve</button>
    </div>
  </article>;
}
