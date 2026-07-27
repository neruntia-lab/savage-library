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
        <div className="hero-grid-lines" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span aria-hidden="true">◆</span>
              The adventurer&apos;s digital archive
            </p>
            <h1>
              Forge your legend.
              <span> Find the right resource.</span>
            </h1>
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
                Search the archive
              </button>
            </form>
            <div className="hero-trust" aria-label="Library highlights">
              <span>
                <strong>Curated</strong>
                <small>Quality-first resources</small>
              </span>
              <span>
                <strong>Compatible</strong>
                <small>Clear Foundry support</small>
              </span>
              <span>
                <strong>Authorized</strong>
                <small>Creator-respecting releases</small>
              </span>
            </div>
          </div>
          <aside className="hero-mark" aria-label="Savage Library">
            <div className="sigil-frame" aria-hidden="true">
              <span className="sigil-orbit sigil-orbit-one" />
              <span className="sigil-orbit sigil-orbit-two" />
              <Image
                src="/savage-library-logo.svg"
                alt=""
                width={145}
                height={196}
                priority
              />
            </div>
            <div>
              <span>Curated for Foundry VTT</span>
              <strong>Enter the archive</strong>
            </div>
          </aside>
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
