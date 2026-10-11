import { CelestialOrnament } from "../components/ui/CelestialOrnament";
import { CatalogFilters } from "../components/library/CatalogFilters";
import { ProgressiveCatalog } from "../components/library/ProgressiveCatalog";
import {
  getCatalogFacets,
  listCatalog,
} from "../lib/repositories/resource-repository";
import { getSiteAppearance } from "../lib/repositories/site-settings-repository";
import {
  catalogFilterParams,
  parsePublicCatalogFilters,
} from "../lib/services/catalog";

export const revalidate = 120;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parsePublicCatalogFilters(await searchParams, {
    pageSize: 24,
  });
  const [catalog, facets, appearance] = await Promise.all([
    listCatalog(filters),
    getCatalogFacets(),
    getSiteAppearance(),
  ]);
  const searchFields = Object.entries(catalogFilterParams(filters)).filter(
    ([name]) => name !== "q",
  );

  return (
    <>
      <section
        className="hero hero-image"
        style={{ backgroundImage: `url("${appearance.heroImageUrl}")` }}
        aria-label="Search the Savage Library"
      >
        <div className="container hero-search-wrap">
          <div className="archive-masthead">
            <CelestialOrnament variant="sun" className="archive-sun" />
            <div>
              <h1>Savage Library</h1>
              <p className="archive-subtitle">
                Expand your campaign. Enhance your game.
              </p>
              <span className="archive-divider" aria-hidden="true">
                ✦
              </span>
            </div>
            <CelestialOrnament variant="moon" className="archive-moon" />
          </div>
          <form className="hero-search" action="/#library" method="get">
            {searchFields.map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <label className="sr-only" htmlFor="home-search">
              Search the library
            </label>
            <input
              key={filters.query ?? ""}
              id="home-search"
              name="q"
              type="search"
              defaultValue={filters.query}
              placeholder="Search modules, classes, authors, or tags"
              autoComplete="off"
            />
            <button className="button button-primary" type="submit">
              Search the archive
            </button>
          </form>
        </div>
      </section>

      <section
        id="library"
        className="section home-library"
        aria-labelledby="library-title"
      >
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Resource catalog</p>
              <h2 id="library-title">Browse the library</h2>
            </div>
          </div>
          <CatalogFilters
            filters={filters}
            facets={facets}
            action="/#library"
            showSearch={false}
          />
          <div className="catalog-summary" aria-live="polite">
            <strong>{catalog.total}</strong>{" "}
            {catalog.total === 1 ? "resource" : "resources"}
            {filters.query ? ` matching “${filters.query}”` : ""}
          </div>
          <ProgressiveCatalog
            key={JSON.stringify(filters)}
            initial={catalog}
            filters={filters}
          />
        </div>
      </section>
    </>
  );
}
