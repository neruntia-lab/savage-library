import Link from "next/link";
import Image from "next/image";
import { CATEGORY_LINKS, ROUTES, SITE_CONFIG } from "../../lib/config/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link className="brand" href={ROUTES.home}>
            <span className="brand-mark">
              <Image
                src="/savage-library-logo.svg"
                alt=""
                width={30}
                height={41}
              />
            </span>
            <span className="brand-copy">
              <strong>{SITE_CONFIG.name}</strong>
              <small>The adventurer&apos;s archive</small>
            </span>
          </Link>
          <p>{SITE_CONFIG.tagline}</p>
        </div>
        <nav aria-label="Library categories">
          {CATEGORY_LINKS.map((category) => (
            <Link href={ROUTES.category(category.slug)} key={category.slug}>
              {category.name}
            </Link>
          ))}
        </nav>
        <div className="footer-meta">
          <p>Only authorized resources enter the archive.</p>
        </div>
      </div>
    </footer>
  );
}
