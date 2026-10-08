"use client";

import { useRouter } from "next/navigation";
import {
  useMemo,
  useOptimistic,
  useRef,
  useTransition,
  type FormEvent,
} from "react";
import { ROUTES } from "../../lib/config/site";
import {
  RESOURCE_TYPES,
  SORT_OPTIONS,
  type CatalogFacets,
  type CatalogFilters as Filters,
} from "../../lib/domain/resource";

const labels: Record<string, string> = {
  module: "Foundry module",
  pdf: "PDF",
  macro: "Macro",
  class: "Class",
  subclass: "Subclass",
  "recently-added": "Recently added",
  "recently-updated": "Recently updated",
  alphabetical: "Alphabetical",
  "most-downloaded": "Most downloaded",
  "most-popular": "Most popular",
};
type Selection = { type: string; system: string; sort: string };

export function CatalogFilters({
  filters,
  facets,
  fixedCategory,
  action,
  showSearch = true,
}: {
  filters: Filters;
  facets: CatalogFacets;
  fixedCategory?: string;
  action?: string;
  showSearch?: boolean;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const initial = useMemo(
    () => ({
      type: filters.resourceType ?? "",
      system: filters.system ?? "",
      sort: filters.sort,
    }),
    [filters.resourceType, filters.system, filters.sort],
  );
  const [selection, select] = useOptimistic(
    initial as Selection,
    (current, update: Partial<Selection>) => ({ ...current, ...update }),
  );
  const destination =
    action ?? (fixedCategory ? ROUTES.category(fixedCategory) : ROUTES.library);

  function navigate(update: Partial<Selection> = {}) {
    const next = { ...selection, ...update };
    const query = showSearch
      ? String(new FormData(form.current!).get("q") ?? "").trim()
      : filters.query;
    const params = new URLSearchParams();
    if (query) params.set("q", query.slice(0, 120));
    if (next.type) params.set("type", next.type);
    if (next.system) params.set("system", next.system);
    params.set("sort", next.sort);
    const [path, fragment] = destination.split("#");
    startTransition(() => {
      select(update);
      router.replace(
        `${path}?${params.toString()}${fragment ? `#${fragment}` : ""}`,
        { scroll: false },
      );
    });
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate();
  }

  return (
    <form
      ref={form}
      className="catalog-browser-controls"
      method="get"
      action={destination}
      onSubmit={search}
      aria-busy={pending}
    >
      {showSearch ? (
        <div className="filter-search">
          <label htmlFor="library-search">Search resources</label>
          <div>
            <input
              key={filters.query ?? ""}
              id="library-search"
              name="q"
              type="search"
              defaultValue={filters.query}
              placeholder="Title, author, tag, or system"
            />
            <button className="button button-primary" type="submit">
              Search
            </button>
          </div>
        </div>
      ) : filters.query ? (
        <input type="hidden" name="q" value={filters.query} />
      ) : null}
      <div className="catalog-control-bar">
        <fieldset className="catalog-filter-group">
          <legend className="sr-only">Catalog filters</legend>
          <label>
            <span>Source type</span>
            <select
              name="type"
              value={selection.type}
              onChange={(event) => navigate({ type: event.target.value })}
            >
              <option value="">All types</option>
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {labels[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Game system</span>
            <select
              name="system"
              value={selection.system}
              onChange={(event) => navigate({ system: event.target.value })}
            >
              <option value="">All systems</option>
              {facets.gameSystems.map((system) => (
                <option key={system.id} value={system.slug}>
                  {system.name}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        <label className="catalog-sort">
          <span>Sort by</span>
          <select
            name="sort"
            value={selection.sort}
            onChange={(event) => navigate({ sort: event.target.value })}
          >
            {SORT_OPTIONS.map((sort) => (
              <option key={sort} value={sort}>
                {labels[sort]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="catalog-control-feedback">
        <p role="status" aria-live="polite">
          {pending ? "Updating results…" : ""}
        </p>
        {selection.type || selection.system ? (
          <button
            className="catalog-clear"
            type="button"
            onClick={() => {
              form.current
                ?.querySelector<HTMLSelectElement>('select[name="type"]')
                ?.focus();
              navigate({ type: "", system: "" });
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </form>
  );
}
