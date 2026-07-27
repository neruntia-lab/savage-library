import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogFilters } from "../../../components/library/CatalogFilters";
import { ResourceGrid } from "../../../components/resources/ResourceGrid";
import { CATEGORY_LINKS } from "../../../lib/config/site";
import {
  getCatalogFacets,
  listCatalog,
} from "../../../lib/repositories/resource-repository";
import { parseCatalogFilters } from "../../../lib/services/catalog";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = CATEGORY_LINKS.find((entry) => entry.slug === slug);
  return category
    ? {
        title: category.name,
        description: category.description,
      }
    : {};
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = CATEGORY_LINKS.find((entry) => entry.slug === slug);
  if (!category) notFound();

  const filters = parseCatalogFilters(query, { category: slug });
  const [catalog, facets] = await Promise.all([
    listCatalog(filters),
    getCatalogFacets(),
  ]);

  return (
    <section className="section page-section">
      <div className="container">
        <div className="page-heading">
          <p className="eyebrow">Category</p>
          <h1>{category.name}</h1>
          <p>{category.description}</p>
        </div>
        <CatalogFilters
          filters={filters}
          facets={facets}
          fixedCategory={slug}
        />
        <div className="catalog-summary">
          <strong>{catalog.total}</strong>{" "}
          {catalog.total === 1 ? "resource" : "resources"}
        </div>
        <ResourceGrid resources={catalog.items} />
      </div>
    </section>
  );
}
