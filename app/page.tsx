import Link from "next/link";
import Image from "next/image";
import { ResourceGrid } from "../components/resources/ResourceGrid";
import { CATEGORY_LINKS, ROUTES, SITE_CONFIG } from "../lib/config/site";
import { getFeaturedResources } from "../lib/repositories/resource-repository";

export const revalidate = 300;

export default async function HomePage() {
  const featured = await getFeaturedResources(3);

  return (
    <>
      <section className="hero section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Authorized tabletop resources</p>
            <h1>Build your world. Find the right resource fast.</h1>
            <p className="hero-description">{SITE_CONFIG.tagline}</p>
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
                Search library
              </button>
            </form>
          </div>
          <div className="hero-mark" aria-hidden="true">
            <Image src="/logo-mark.svg" alt="" width={94} height={128} priority />
            <span>Curated for Foundry VTT</span>
          </div>
        </div>
      </section>

      <section className="section section-tight" aria-labelledby="categories-title">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Browse by format</p>
              <h2 id="categories-title">Categories</h2>
            </div>
            <Link className="text-link" href={ROUTES.library}>
              View full library <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="category-grid">
            {CATEGORY_LINKS.map((category) => (
              <Link
                className="category-card"
                href={ROUTES.category(category.slug)}
                key={category.slug}
              >
                <span className="category-icon" aria-hidden="true">
                  {category.name.charAt(0)}
                </span>
                <span>
                  <strong>{category.name}</strong>
                  <small>{category.description}</small>
                </span>
                <span className="category-arrow" aria-hidden="true">
                  →
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
              <p className="eyebrow">Featured and recently updated</p>
              <h2 id="featured-title">Start here</h2>
            </div>
          </div>
          <ResourceGrid resources={featured} />
        </div>
      </section>
    </>
  );
}
