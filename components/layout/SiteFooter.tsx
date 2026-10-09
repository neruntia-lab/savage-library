import Link from "next/link";
import Image from "next/image";
import { PUBLIC_NAVIGATION, ROUTES, SITE_CONFIG } from "../../lib/config/site";

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
              <small>D&amp;D Content &amp; Foundry Modules</small>
            </span>
          </Link>
          <p>{SITE_CONFIG.tagline}</p>
        </div>
        <nav aria-label="Footer navigation">
          {PUBLIC_NAVIGATION.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
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
