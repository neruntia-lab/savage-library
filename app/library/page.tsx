import type { Metadata } from "next";
import { CatalogFilters } from "../../components/library/CatalogFilters";
import { Pagination } from "../../components/library/Pagination";
import { ResourceGrid } from "../../components/resources/ResourceGrid";
import { getCatalogFacets, listCatalog } from "../../lib/repositories/resource-repository";
import { parseCatalogFilters } from "../../lib/services/catalog";

export const metadata: Metadata = {
  title: "Library",
  description:
    "Search and filter authorized Foundry VTT modules, classes, subclasses, and PDFs.",
};

export const revalidate = 120;

type LibraryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const filters = parseCatalogFilters(params);
  const [catalog, facets] = await Promise.all([
    listCatalog(filters),
    getCatalogFacets(),
  ]);

  return (
    <section className="section page-section">
      <div className="container">
        <div className="page-heading">
          <p className="eyebrow">Resource catalog</p>
          <h1>Library</h1>
          <p>
            Search, filter, and sort authorized resources. Active filters stay
            in the URL for easy sharing.
          </p>
        </div>

        <CatalogFilters filters={filters} facets={facets} />

        <div className="catalog-summary" aria-live="polite">
          <strong>{catalog.total}</strong>{" "}
          {catalog.total === 1 ? "resource" : "resources"}
          {filters.query ? ` matching “${filters.query}”` : ""}
        </div>

        <ResourceGrid resources={catalog.items} />
        <Pagination
          page={catalog.page}
          pageCount={catalog.pageCount}
          searchParams={params}
        />
      </div>
    </section>
  );
}
