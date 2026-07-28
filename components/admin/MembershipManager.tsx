"use client";

import { useEffect, useMemo, useState } from "react";

type Tier = { id: string; title: string; amountCents: number };
type Member = { id: string; displayName: string; isActive: boolean; tierIds: string[]; source: "patreon" };
type Grant = { id: string; displayName: string; email: string; status: string; tierIds: string[]; expiresAt: string | null; source: "complimentary" };
type Post = { id: string; slug: string; title: string; isPublished: boolean; resourceId: string | null; lastSyncedAt: string };

export function MembershipManager({ onStatus }: { onStatus: (message: string) => void }) {
  const [data, setData] = useState<{ tiers: Tier[]; members: Member[]; grants: Grant[] }>({ tiers: [], members: [], grants: [] });
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);

  async function load() {
    const [response, postResponse] = await Promise.all([
      fetch("/api/admin/memberships"),
      fetch("/api/admin/patreon/posts"),
    ]);
    if (response.ok) setData(await response.json());
    if (postResponse.ok) setPosts((await postResponse.json()).posts);
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    onStatus("Synchronizing Patreon members, tiers, and posts…");
    const response = await fetch("/api/admin/patreon/sync", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    onStatus(response.ok ? `${body.memberCount} members and ${body.postCount} posts synchronized.` : body.error ?? "Synchronization failed.");
    if (response.ok) await load();
    setBusy(false);
  }

  async function updatePost(post: Post, action: "publish" | "resync" | "associate") {
    const resourceId =
      action === "associate"
        ? window.prompt("Existing library resource ID (leave blank to unlink)", post.resourceId ?? "")
        : undefined;
    if (action === "associate" && resourceId === null) return;
    const response = await fetch("/api/admin/patreon/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: post.id,
        ...(action === "publish" ? { isPublished: !post.isPublished } : {}),
        ...(action === "resync" ? { resync: true } : {}),
        ...(action === "associate" ? { resourceId } : {}),
      }),
    });
    onStatus(response.ok ? "Patreon post updated." : "Post update failed.");
    if (response.ok) await load();
  }

  return <div className="membership-admin">
    <div className="admin-stats">
      <div><span>Patreon members</span><strong>{data.members.filter((member) => member.isActive).length}</strong><small>active</small></div>
      <div><span>Complimentary</span><strong>{data.grants.filter((grant) => grant.status === "active").length}</strong><small>active grants</small></div>
      {data.tiers.filter((tier) => tier.amountCents > 0).slice(0, 2).map((tier) =>
        <div key={tier.id}><span>{tier.title}</span><strong>{[...data.members, ...data.grants].filter((row) => row.tierIds.includes(tier.id)).length}</strong><small>assigned</small></div>)}
    </div>
    <section className="admin-panel patreon-settings">
      <div><p className="eyebrow">Campaign connection</p><h2>Patreon synchronization</h2><p>Refresh tiers, subscriber status, and public news posts.</p></div>
      <div className="profile-actions">
        <a className="button button-secondary" href="/api/admin/patreon/connect">Connect creator account</a>
        <button className="button button-primary" onClick={synchronize} disabled={busy}>{busy ? "Working…" : "Synchronize Patreon"}</button>
      </div>
    </section>
    <section className="admin-panel">
      <h2>Grant complimentary access</h2>
      <form className="grant-form" onSubmit={createGrant}>
        <input name="email" type="email" required placeholder="member@example.com" />
        <input name="expiresAt" type="datetime-local" aria-label="Optional expiration" />
        <input name="reason" placeholder="Reason" />
        <input name="internalNote" placeholder="Internal note" />
        <fieldset><legend>Equivalent paid tiers</legend>{data.tiers.filter((tier) => tier.amountCents > 0).map((tier) =>
          <label key={tier.id}><input type="checkbox" name="tierIds" value={tier.id} />{tier.title}</label>)}
        </fieldset>
        <button className="button button-primary" disabled={busy}>Grant access</button>
      </form>
    </section>
    <section className="admin-panel">
      <div className="admin-filter-bar">
        <input type="search" placeholder="Search members…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All members</option><option value="patreon">Patreon</option>
          <option value="complimentary">Complimentary</option><option value="active">Active</option>
          <option value="inactive">Inactive / expired</option><option value="expired">Expired grants</option>
          <option value="replaced">Replaced by Patreon</option>
        </select>
      </div>
      <div className="membership-list">{rows.map((row) =>
        <div key={`${row.source}-${row.id}`} className="membership-row">
          <div><strong>{row.displayName}</strong><small>{row.source === "patreon" ? `Patreon · ${row.isActive ? "active" : "inactive"}` : `${row.email} · complimentary · ${row.status}`}</small></div>
          <span>{row.tierIds.map((id) => data.tiers.find((tier) => tier.id === id)?.title ?? id).join(", ") || "No tier"}</span>
          {row.source === "complimentary" && row.status === "active" ? <div className="profile-actions"><button className="button button-secondary button-small" onClick={() => resend(row.id)}>Resend link</button><button className="button button-secondary button-small" onClick={() => revoke(row.id)}>Revoke</button></div> : null}
        </div>)}</div>
    </section>
    <section className="admin-panel">
      <h2>Synchronized posts</h2>
      <div className="membership-list">{posts.map((post) =>
        <div className="membership-row" key={post.id}>
          <div><strong>{post.title}</strong><small>{post.isPublished ? "Published" : "Hidden"} · synced {new Date(post.lastSyncedAt).toLocaleString()}</small></div>
          <span>{post.resourceId ? `Resource: ${post.resourceId}` : "No linked resource"}</span>
          <div className="profile-actions">
            <button className="button button-secondary button-small" onClick={() => updatePost(post, "resync")}>Resync</button>
            <button className="button button-secondary button-small" onClick={() => updatePost(post, "associate")}>Associate</button>
            <button className="button button-secondary button-small" onClick={() => updatePost(post, "publish")}>{post.isPublished ? "Hide" : "Publish"}</button>
          </div>
        </div>)}</div>
    </section>
  </div>;
}
