"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogFacets } from "../../lib/domain/resource";
import type { SiteAppearance } from "../../lib/domain/site-appearance";
import { AdminResourceList } from "./AdminResourceList";
import { AppearanceSettings } from "./AppearanceSettings";
import { TaxonomyManager } from "./TaxonomyManager";
import type { AdminResource } from "./types";

export function AdminDashboard({
  initialResources,
  facets,
  initialAppearance,
}: {
  initialResources: AdminResource[];
  facets: CatalogFacets;
  initialAppearance: SiteAppearance;
}) {
  const [resources, setResources] = useState(initialResources);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<
    "all" | "published" | "draft" | "patreon"
  >("all");
  const [activePanel, setActivePanel] = useState<
    "resources" | "metadata" | "appearance" | "patreon"
  >("resources");

  const visibleResources = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return resources.filter((resource) => {
      if (
        normalized &&
        !`${resource.title} ${resource.slug} ${resource.resourceType}`
          .toLowerCase()
          .includes(normalized)
      ) {
        return false;
      }
      if (visibility === "published" && !resource.isPublished) return false;
      if (visibility === "draft" && resource.isPublished) return false;
      if (visibility === "patreon" && resource.accessMode !== "patreon") {
        return false;
      }
      return true;
    });
  }, [query, resources, visibility]);

  const publishedCount = resources.filter((resource) => resource.isPublished).length;
  const protectedCount = resources.filter(
    (resource) => resource.accessMode === "patreon",
  ).length;
  const totalDownloads = resources.reduce(
    (total, resource) => total + resource.downloadCount,
    0,
  );

  async function refreshResources() {
    const response = await fetch("/api/resources?admin=1");
    if (!response.ok) return;
    const body = (await response.json()) as { resources: AdminResource[] };
    setResources(body.resources);
  }

  async function togglePublication(resource: AdminResource) {
    setStatus(
      resource.isPublished ? "Returning entry to draft…" : "Publishing entry…",
    );
    const response = await fetch(`/api/resources/${resource.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !resource.isPublished }),
    });
    setStatus(
      response.ok
        ? resource.isPublished
          ? "Entry returned to drafts."
          : "Entry published."
        : "Publication status could not be changed.",
    );
    if (response.ok) await refreshResources();
  }

  async function deleteResource(resource: AdminResource) {
    const confirmed = window.prompt(
      `Type ${resource.title} to permanently delete this entry and its files.`,
    );
    if (confirmed !== resource.title) return;

    setStatus(`Deleting ${resource.title}…`);
    const response = await fetch(`/api/resources/${resource.id}`, {
      method: "DELETE",
    });
    setStatus(
      response.ok ? "Entry permanently deleted." : "The entry could not be deleted.",
    );
    if (response.ok) await refreshResources();
  }

  return (
    <>
      <div className="admin-stats" aria-label="Library statistics">
        <Stat label="Resources" value={resources.length} detail="all entries" />
        <Stat label="Published" value={publishedCount} detail="visible now" />
        <Stat
          label="Patreon"
          value={protectedCount}
          detail="protected entries"
        />
        <Stat
          label="Downloads"
          value={totalDownloads.toLocaleString()}
          detail="recorded transfers"
        />
      </div>

      <div className="admin-command-bar">
        <div className="admin-tabs" role="tablist" aria-label="Admin sections">
          <TabButton
            active={activePanel === "resources"}
            onClick={() => setActivePanel("resources")}
          >
            Content
          </TabButton>
          <TabButton
            active={activePanel === "metadata"}
            onClick={() => setActivePanel("metadata")}
          >
            Taxonomy
          </TabButton>
          <TabButton
            active={activePanel === "appearance"}
            onClick={() => setActivePanel("appearance")}
          >
            Appearance
          </TabButton>
          <TabButton
            active={activePanel === "patreon"}
            onClick={() => setActivePanel("patreon")}
          >
            Patreon
          </TabButton>
        </div>
        <Link className="button button-primary" href="/admin/resources/new">
          + Add content
        </Link>
      </div>

      <p className="admin-live-status" aria-live="polite">
        {status}
      </p>

      {activePanel === "resources" ? (
        <>
          <div className="admin-filter-bar">
            <label className="admin-search">
              <span className="sr-only">Search content</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, slug, or type…"
              />
            </label>
            <label>
              <span className="sr-only">Filter by publication</span>
              <select
                value={visibility}
                onChange={(event) =>
                  setVisibility(
                    event.target.value as
                      | "all"
                      | "published"
                      | "draft"
                      | "patreon",
                  )
                }
              >
                <option value="all">All content</option>
                <option value="published">Published</option>
                <option value="draft">Drafts</option>
                <option value="patreon">Patreon-only</option>
              </select>
            </label>
            <span>{visibleResources.length} shown</span>
          </div>
          <AdminResourceList
            resources={visibleResources}
            onPublicationToggle={togglePublication}
            onDelete={deleteResource}
          />
        </>
      ) : activePanel === "metadata" ? (
        <TaxonomyManager facets={facets} onStatus={setStatus} />
      ) : activePanel === "appearance" ? (
        <AppearanceSettings
          initialAppearance={initialAppearance}
          onStatus={setStatus}
        />
      ) : (
        <PatreonSettings onStatus={setStatus} />
      )}
    </>
  );
}

function PatreonSettings({
  onStatus,
}: {
  onStatus: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    onStatus("Synchronizing Patreon tiers…");
    const response = await fetch("/api/admin/patreon/tiers", { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as {
      count?: number;
      error?: string;
    };
    onStatus(
      response.ok
        ? `${body.count ?? 0} Patreon tiers synchronized.`
        : body.error ?? "Patreon could not be synchronized.",
    );
    setBusy(false);
  }

  return (
    <section className="admin-panel patreon-settings">
      <div>
        <p className="eyebrow">Membership connection</p>
        <h2>Patreon access</h2>
        <p>
          Refresh the available campaign tiers before assigning them to protected
          resources. Membership is checked live whenever a protected file is
          downloaded.
        </p>
      </div>
      <button
        type="button"
        className="button button-primary"
        onClick={sync}
        disabled={busy}
      >
        {busy ? "Synchronizing…" : "Synchronize tiers"}
      </button>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={active ? "active" : ""}
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
    >
      {children}
    </button>
  );
}
