import Link from "next/link";
import Image from "next/image";
import { CATEGORY_LINKS, ROUTES, SITE_CONFIG } from "../../lib/config/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link className="brand" href={ROUTES.home}>
            <Image src="/logo-mark.svg" alt="" width={22} height={30} />
            <span>{SITE_CONFIG.name}</span>
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
          <p>Only authorized resources are published.</p>
          <Link href={ROUTES.admin}>Admin</Link>
        </div>
      </div>
    </footer>
  );
}
