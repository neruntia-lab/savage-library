"use client";

import { useEffect, useState } from "react";

type TokenRow = { id: string; name: string; tokenPrefix: string; scopes: string[]; createdAt: string; expiresAt: string | null; lastUsedAt: string | null; revokedAt: string | null };
const scopes = ["resource:create", "resource:update", "publish"];

export function CliTokenManager({ onStatus }: { onStatus: (message: string) => void }) {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [name, setName] = useState("Savage Library CLI");
  const [selected, setSelected] = useState(scopes);
  const [expiresAt, setExpiresAt] = useState("");
  const [plainToken, setPlainToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadedAt] = useState(() => Date.now());

  async function load() {
    const response = await fetch("/api/admin/cli-tokens");
    const body = (await response.json().catch(() => ({}))) as { tokens?: TokenRow[]; error?: string };
    if (response.ok) setTokens(body.tokens ?? []); else onStatus(body.error ?? "CLI tokens could not be loaded.");
  }
  // Loading is the external synchronization this effect owns.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    setBusy(true); setPlainToken("");
    const response = await fetch("/api/admin/cli-tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, scopes: selected, expiresAt: expiresAt || null }) });
    const body = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
    if (response.ok && body.token) { setPlainToken(body.token); onStatus("Administrator CLI token created. Copy it now."); await load(); }
    else onStatus(body.error ?? "CLI token could not be created.");
    setBusy(false);
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this CLI token immediately?")) return;
    const response = await fetch(`/api/admin/cli-tokens/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Revoked from admin dashboard" }) });
    onStatus(response.ok ? "CLI token revoked." : "CLI token could not be revoked.");
    if (response.ok) await load();
  }

  return <section className="admin-panel cli-token-manager">
    <div className="admin-panel-heading"><div><p className="eyebrow">Publisher automation</p><h2>CLI access</h2></div><span>{tokens.filter((token) => !token.revokedAt).length} active</span></div>
    <p>Create a named administrator credential so the CLI can create catalog entries, synchronize declared metadata, and optionally publish free modules. The secret is shown once.</p>
    <div className="admin-form-grid">
      <label><span>Token name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label><span>Expiration (optional)</span><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
    </div>
    <fieldset><legend>Scopes</legend><div className="checkbox-grid">{scopes.map((scope) => <label key={scope}><input type="checkbox" checked={selected.includes(scope)} onChange={(event) => setSelected(event.target.checked ? [...selected, scope] : selected.filter((value) => value !== scope))} /> {scope}</label>)}</div></fieldset>
    <button className="button button-primary" type="button" disabled={busy || !name.trim() || !selected.length} onClick={create}>{busy ? "Creating…" : "Create CLI token"}</button>
    {plainToken ? <div className="publisher-token"><strong>Copy this token now. It will not be shown again.</strong><code>{plainToken}</code><p>Run <code>node scripts/savage-library.mjs login --token TOKEN</code> once on this computer.</p></div> : null}
    <div className="admin-table-wrap"><table className="admin-data-table"><thead><tr><th>Name</th><th>Scopes</th><th>Last used</th><th>Status</th><th>Actions</th></tr></thead><tbody>{tokens.map((token) => <tr key={token.id}><td data-label="Name">{token.name}<small>{token.tokenPrefix}…</small></td><td data-label="Scopes">{token.scopes.join(", ")}</td><td data-label="Last used">{token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "Never"}</td><td data-label="Status">{token.revokedAt ? "Revoked" : token.expiresAt && Date.parse(token.expiresAt) <= loadedAt ? "Expired" : "Active"}</td><td data-label="Actions">{!token.revokedAt ? <button className="button button-danger button-small" type="button" onClick={() => revoke(token.id)}>Revoke</button> : "—"}</td></tr>)}</tbody></table></div>
  </section>;
}
