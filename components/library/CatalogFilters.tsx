"use client";

import Link from "next/link";
import { useState } from "react";
import { ROUTES } from "../../lib/config/site";
import {
  COMPATIBILITY_STATUSES,
  PRICING_TYPES,
  RESOURCE_TYPES,
  SORT_OPTIONS,
  type CatalogFacets,
  type CatalogFilters,
} from "../../lib/domain/resource";

const labels: Record<string, string> = {
  module: "Module",
  class: "Class",
  subclass: "Subclass",
  pdf: "PDF",
  free: "Free",
  premium: "Premium",
  verified: "Verified",
  compatible: "Compatible",
  untested: "Untested",
  outdated: "Outdated",
  unsupported: "Unsupported",
  "recently-added": "Recently added",
  "recently-updated": "Recently updated",
  alphabetical: "Alphabetical",
  "most-downloaded": "Most downloaded",
  "most-popular": "Most popular",
};

export function CatalogFilters({
  filters,
  facets,
  fixedCategory,
}: {
  filters: CatalogFilters;
  facets: CatalogFacets;
  fixedCategory?: string;
}) {
  const activeFilterCount = [
    filters.resourceType,
    filters.system,
    filters.foundryVersion,
    filters.moduleVersion,
    filters.classOrSubclass,
    filters.pricing,
    filters.tag,
    filters.author,
    filters.compatibility,
    filters.sort !== "recently-added" ? filters.sort : undefined,
  ].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);

  return (
    <form className="catalog-filters" method="get">
      <div className="filter-search">
        <label htmlFor="library-search">Search resources</label>
        <div>
          <input
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

      {fixedCategory ? (
        <input type="hidden" name="category" value={fixedCategory} />
      ) : null}

      <button
        className="filter-toggle"
        type="button"
        aria-expanded={filtersOpen}
        aria-controls="advanced-catalog-filters"
        onClick={() => setFiltersOpen((value) => !value)}
      >
        <span>Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
        <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
      </button>

      <div
        id="advanced-catalog-filters"
        className={`filter-advanced ${filtersOpen ? "is-open" : ""}`}
      >
        <div className="filter-grid">
          <FilterSelect
            label="Resource type"
            name="type"
            value={filters.resourceType}
            options={RESOURCE_TYPES.map((value) => ({
              value,
              label: labels[value],
            }))}
          />
        <FilterSelect
          label="Game system"
          name="system"
          value={filters.system}
          options={facets.gameSystems.map((system) => ({
            value: system.slug,
            label: system.name,
          }))}
        />
        <FilterSelect
          label="Foundry version"
          name="foundry"
          value={filters.foundryVersion}
          options={facets.foundryVersions.map((version) => ({
            value: version,
            label: `Foundry ${version}`,
          }))}
        />
        <FilterSelect
          label="Module version"
          name="version"
          value={filters.moduleVersion}
          options={facets.moduleVersions.map((version) => ({
            value: version,
            label: version,
          }))}
        />
        <FilterSelect
          label="Class or subclass"
          name="class"
          value={filters.classOrSubclass}
          options={facets.classes.map((name) => ({ value: name, label: name }))}
        />
        <FilterSelect
          label="Price"
          name="pricing"
          value={filters.pricing}
          options={PRICING_TYPES.map((value) => ({
            value,
            label: labels[value],
          }))}
        />
        <FilterSelect
          label="Tag"
          name="tag"
          value={filters.tag}
          options={facets.tags.map((tag) => ({
            value: tag.slug,
            label: tag.name,
          }))}
        />
        <FilterSelect
          label="Author"
          name="author"
          value={filters.author}
          options={facets.authors.map((author) => ({
            value: author.slug,
            label: author.name,
          }))}
        />
        <FilterSelect
          label="Compatibility"
          name="compatibility"
          value={filters.compatibility}
          options={COMPATIBILITY_STATUSES.map((value) => ({
            value,
            label: labels[value],
          }))}
        />
        <FilterSelect
          label="Sort"
          name="sort"
          value={filters.sort}
          includeAny={false}
          options={SORT_OPTIONS.map((value) => ({
            value,
            label: labels[value],
          }))}
        />
        </div>

        <div className="filter-actions">
          <button className="button button-secondary" type="submit">
            Apply filters
          </button>
          <Link
            className="button button-quiet"
            href={fixedCategory ? ROUTES.category(fixedCategory) : ROUTES.library}
          >
            Clear
          </Link>
        </div>
      </div>
    </form>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
  includeAny = true,
}: {
  label: string;
  name: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
  includeAny?: boolean;
}) {
  return (
    <label>
      <span>{label}</span>
      <select name={name} defaultValue={value ?? ""}>
        {includeAny ? <option value="">Any</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
