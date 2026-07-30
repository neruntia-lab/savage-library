"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatalogFacets, NamedEntity } from "../../lib/domain/resource";

type Draft = { name: string; slug: string };

export function TaxonomyManager({
  facets: initialFacets,
  onStatus,
}: {
  facets: CatalogFacets;
  onStatus: (message: string) => void;
}) {
  const [facets, setFacets] = useState(initialFacets);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    draftsFromFacets(initialFacets),
  );
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const groups = useMemo(
    () =>
      [
        ["author", "Authors", facets.authors],
        ["category", "Categories", facets.categories],
        ["system", "Game systems", facets.gameSystems],
        ["tag", "Tags", facets.tags],
      ] as const,
    [facets],
  );

  const refresh = useCallback(async () => {
    const response = await fetch("/api/taxonomy", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.facets) {
      onStatus(body.error ?? "Taxonomy could not be refreshed.");
      return false;
    }
    const next = body.facets as CatalogFacets;
    setFacets(next);
    setDrafts(draftsFromFacets(next));
    return true;
  }, [onStatus]);

  // Refresh server-rendered taxonomy whenever this tab is mounted.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  function setEntryBusy(key: string, value: boolean) {
    setBusy((current) => {
      const next = new Set(current);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function create(
    type: string,
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const key = `create-${type}`;
    setEntryBusy(key, true);
    const response = await fetch("/api/taxonomy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      form.reset();
      const refreshed = await refresh();
      onStatus(refreshed ? "Taxonomy entry created." : "Entry created, but the list could not be refreshed.");
    } else {
      onStatus(body.error ?? "Taxonomy entry could not be created.");
    }
    setEntryBusy(key, false);
  }

  async function update(type: string, id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setEntryBusy(id, true);
    const response = await fetch(`/api/taxonomy/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...draft }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      const refreshed = await refresh();
      onStatus(refreshed ? "Taxonomy updated." : "Entry updated, but the list could not be refreshed.");
    } else {
      onStatus(body.error ?? "Taxonomy update failed.");
    }
    setEntryBusy(id, false);
  }

  async function remove(type: string, id: string) {
    setEntryBusy(id, true);
    const response = await fetch(
      `/api/taxonomy/${encodeURIComponent(id)}?type=${encodeURIComponent(type)}`,
      { method: "DELETE" },
    );
    const body = response.status === 204
      ? {}
      : await response.json().catch(() => ({}));
    if (response.ok) {
      const refreshed = await refresh();
      onStatus(refreshed ? "Taxonomy entry deleted." : "Entry deleted, but the list could not be refreshed.");
    } else {
      onStatus(body.error ?? "Taxonomy entry is in use or could not be deleted.");
    }
    setEntryBusy(id, false);
  }

  function updateDraft(id: string, field: keyof Draft, value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  }

  return (
    <div className="taxonomy-grid">
      {groups.map(([type, title, items]) => (
        <section className="admin-panel" key={type}>
          <div className="admin-panel-heading">
            <h2>{title}</h2>
            <span>{items.length}</span>
          </div>
          <form
            className="taxonomy-create"
            onSubmit={(event) => create(type, event)}
          >
            <input type="hidden" name="type" value={type} />
            <input name="name" placeholder={`New ${type} name`} required />
            <input name="slug" placeholder="url-slug" required />
            <button
              className="button button-primary button-small"
              disabled={busy.has(`create-${type}`)}
            >
              {busy.has(`create-${type}`) ? "Adding…" : "Add"}
            </button>
          </form>
          <div className="taxonomy-list">
            {items.map((item) => (
              <form
                key={item.id}
                onSubmit={(event) => {
                  event.preventDefault();
                  void update(type, item.id);
                }}
              >
                <input
                  name="name"
                  value={drafts[item.id]?.name ?? item.name}
                  onChange={(event) => updateDraft(item.id, "name", event.target.value)}
                  required
                />
                <input
                  name="slug"
                  value={drafts[item.id]?.slug ?? item.slug}
                  onChange={(event) => updateDraft(item.id, "slug", event.target.value)}
                  required
                />
                <button
                  className="button button-secondary button-small"
                  disabled={busy.has(item.id)}
                >
                  {busy.has(item.id) ? "Saving…" : "Update"}
                </button>
                <button
                  className="button button-danger button-small"
                  type="button"
                  disabled={busy.has(item.id)}
                  onClick={() => void remove(type, item.id)}
                >
                  Delete
                </button>
              </form>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function draftsFromFacets(facets: CatalogFacets) {
  return [
    ...facets.authors,
    ...facets.categories,
    ...facets.gameSystems,
    ...facets.tags,
  ].reduce<Record<string, Draft>>((result, item: NamedEntity) => {
    result[item.id] = { name: item.name, slug: item.slug };
    return result;
  }, {});
}
