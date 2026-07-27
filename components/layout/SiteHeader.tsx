import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "../../lib/config/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link
          className="brand"
          href={ROUTES.home}
          aria-label="Savage Library home"
        >
          <span className="brand-mark">
            <Image
              src="/savage-library-logo.svg"
              alt=""
              width={34}
              height={46}
              priority
            />
          </span>
          <span className="brand-copy">
            <strong>Savage Library</strong>
            <small>Curated arcana for Foundry VTT</small>
          </span>
        </Link>
        <nav className="header-nav" aria-label="Primary navigation">
          <Link href={ROUTES.library}>Library</Link>
          <Link href={ROUTES.category("foundry-modules")}>Modules</Link>
          <Link href={ROUTES.category("classes")}>Classes</Link>
          <Link href={ROUTES.category("subclasses")}>Subclasses</Link>
          <Link className="nav-account" href={ROUTES.account}>
            Account
          </Link>
        </nav>
      </div>
    </header>
  );
}
