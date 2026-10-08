"use client";

import {
  fetchApi,
  requestJson,
  type ApiFailure,
} from "../../lib/client/request";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CatalogFacets } from "../../lib/domain/resource";
import type { SiteAppearance } from "../../lib/domain/site-appearance";
import { AdminResourceList } from "./AdminResourceList";
import type { AdminResource } from "./types";
const AppearanceSettings = dynamic(() =>
  import("./AppearanceSettings").then((m) => m.AppearanceSettings),
);
const TaxonomyManager = dynamic(() =>
  import("./TaxonomyManager").then((m) => m.TaxonomyManager),
);
const MembershipManager = dynamic(() =>
  import("./MembershipManager").then((m) => m.MembershipManager),
);
const CliTokenManager = dynamic(() =>
  import("./CliTokenManager").then((m) => m.CliTokenManager),
);
const WikiManager = dynamic(() =>
  import("./WikiManager").then((m) => m.WikiManager),
);

type AdminCatalog = {
  resources: AdminResource[];
  total: number;
  page: number;
  pageCount: number;
  totals: {
    total: number;
    published: number;
    protected: number;
    downloads: number;
  };
};

export function AdminDashboard({
  initialCatalog,
  modules,
  facets,
  initialAppearance,
}: {
  initialCatalog: AdminCatalog;
  modules: Array<{ id: string; slug: string; title: string }>;
  facets: CatalogFacets;
  initialAppearance: SiteAppearance;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [page, setPage] = useState(1);
  const resources = catalog.resources;
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<
    "all" | "published" | "draft" | "patreon"
  >("all");
  const [activePanel, setActivePanel] = useState<
    "resources" | "metadata" | "appearance" | "patreon" | "cli" | "wiki"
  >("resources");

  const refreshResources = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams({
        admin: "1",
        q: query,
        visibility,
        page: String(page),
      });
      const result = await requestJson<ApiFailure & AdminCatalog>(
        `/api/resources?${params}`,
        { signal },
      );
      if (signal?.aborted) return;
      if (result.ok && Array.isArray(result.body.resources)) {
        setCatalog(result.body);
      } else
        setStatus(
          result.body.error ?? "Resources could not be loaded. Please retry.",
        );
    },
    [query, visibility, page],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => void refreshResources(controller.signal),
      250,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [refreshResources]);

  async function togglePublication(resource: AdminResource) {
    setStatus(
      resource.isPublished ? "Returning entry to draft…" : "Publishing entry…",
    );
    const response = await fetchApi(`/api/resources/${resource.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !resource.isPublished }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setStatus(
      response.ok
        ? resource.isPublished
          ? "Entry returned to drafts."
          : "Entry published."
        : (body.error ?? "Publication status could not be changed."),
    );
    if (response.ok) await refreshResources();
  }

  async function deleteResource(resource: AdminResource) {
    const confirmed = window.prompt(
      `Type ${resource.title} to permanently delete this entry and its files.`,
    );
    if (confirmed !== resource.title) return;

    setStatus(`Deleting ${resource.title}…`);
    const response = await fetchApi(`/api/resources/${resource.id}`, {
      method: "DELETE",
    });
    setStatus(
      response.ok
        ? "Entry permanently deleted."
        : "The entry could not be deleted.",
    );
    if (response.ok) await refreshResources();
  }

  return (
    <>
      <div className="admin-stats" aria-label="Library statistics">
        <Stat
          label="Resources"
          value={catalog.totals.total}
          detail="all entries"
        />
        <Stat
          label="Published"
          value={catalog.totals.published}
          detail="visible now"
        />
        <Stat
          label="Patreon"
          value={catalog.totals.protected}
          detail="protected entries"
        />
        <Stat
          label="Downloads"
          value={Number(catalog.totals.downloads).toLocaleString()}
          detail="download requests"
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
            active={activePanel === "wiki"}
            onClick={() => setActivePanel("wiki")}
          >
            Wiki
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
          <TabButton
            active={activePanel === "cli"}
            onClick={() => setActivePanel("cli")}
          >
            CLI Access
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
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search title, slug, or type…"
              />
            </label>
            <label>
              <span className="sr-only">Filter by publication</span>
              <select
                value={visibility}
                onChange={(event) => {
                  setPage(1);
                  setVisibility(
                    event.target.value as
                      "all" | "published" | "draft" | "patreon",
                  );
                }}
              >
                <option value="all">All content</option>
                <option value="published">Published</option>
                <option value="draft">Drafts</option>
                <option value="patreon">Patreon-only</option>
              </select>
            </label>
            <span>
              {resources.length} of {catalog.total} shown
            </span>
          </div>
          <AdminResourceList
            resources={resources}
            onPublicationToggle={togglePublication}
            onDelete={deleteResource}
          />
          {catalog.pageCount > 1 ? (
            <nav className="pagination" aria-label="Content pages">
              <button
                type="button"
                className="button button-secondary"
                disabled={catalog.page <= 1}
                onClick={() => setPage(catalog.page - 1)}
              >
                Previous
              </button>
              <span>
                Page {catalog.page} of {catalog.pageCount}
              </span>
              <button
                type="button"
                className="button button-secondary"
                disabled={catalog.page >= catalog.pageCount}
                onClick={() => setPage(catalog.page + 1)}
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      ) : activePanel === "wiki" ? (
        <WikiManager modules={modules} />
      ) : activePanel === "metadata" ? (
        <TaxonomyManager facets={facets} onStatus={setStatus} />
      ) : activePanel === "appearance" ? (
        <AppearanceSettings
          initialAppearance={initialAppearance}
          onStatus={setStatus}
        />
      ) : activePanel === "patreon" ? (
        <MembershipManager onStatus={setStatus} />
      ) : (
        <CliTokenManager onStatus={setStatus} />
      )}
    </>
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
