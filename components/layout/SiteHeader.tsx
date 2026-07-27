import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "../../lib/config/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href={ROUTES.home} aria-label="Savage Library home">
          <Image src="/logo-mark.svg" alt="" width={24} height={33} priority />
          <span>Savage Library</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href={ROUTES.library}>Library</Link>
          <Link href={ROUTES.category("foundry-modules")}>Modules</Link>
          <Link href={ROUTES.category("classes")}>Classes</Link>
          <Link href={ROUTES.category("subclasses")}>Subclasses</Link>
          <Link href={ROUTES.account}>Account</Link>
        </nav>
      </div>
    </header>
  );
}
