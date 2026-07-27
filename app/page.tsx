import Link from "next/link";
import { ResourceGrid } from "../components/resources/ResourceGrid";
import { CATEGORY_LINKS, ROUTES } from "../lib/config/site";
import { getFeaturedResources } from "../lib/repositories/resource-repository";
import { getSiteAppearance } from "../lib/repositories/site-settings-repository";

export const revalidate = 300;

export default async function HomePage() {
  const [featured, appearance] = await Promise.all([
    getFeaturedResources(3),
    getSiteAppearance(),
  ]);

  return (
    <>
      <section
        className="hero hero-image"
        style={{ backgroundImage: `url("${appearance.heroImageUrl}")` }}
        aria-label="Search the Savage Library"
      >
        <div className="container hero-search-wrap">
          <form className="hero-search" action={ROUTES.library} method="get">
            <label className="sr-only" htmlFor="home-search">
              Search the library
            </label>
            <input
              id="home-search"
              name="q"
              type="search"
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
        className="section section-tight category-section"
        aria-labelledby="categories-title"
      >
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Choose your path</p>
              <h2 id="categories-title">Explore the collection</h2>
            </div>
            <p className="section-intro">
              From ready-to-run modules to character options and field guides,
              every entry is organized for quick discovery.
            </p>
            <Link className="text-link" href={ROUTES.library}>
              Browse everything <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="category-grid">
            {CATEGORY_LINKS.map((category, index) => (
              <Link
                className="category-card"
                href={ROUTES.category(category.slug)}
                key={category.slug}
              >
                <span className="category-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="category-icon" aria-hidden="true">
                  <span>{category.name.charAt(0)}</span>
                </span>
                <span className="category-copy">
                  <strong>{category.name}</strong>
                  <small>{category.description}</small>
                </span>
                <span className="category-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="featured-title">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">From the curator&apos;s desk</p>
              <h2 id="featured-title">Featured discoveries</h2>
            </div>
            <p className="section-intro">
              Noteworthy additions and recently refined tools for your next
              session.
            </p>
          </div>
          <ResourceGrid resources={featured} />
        </div>
      </section>
    </>
  );
}
