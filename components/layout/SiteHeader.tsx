"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ROUTES, PUBLIC_NAVIGATION } from "../../lib/config/site";
import { usePathname } from "next/navigation";
import { patreonConnectUrl } from "../../lib/config/member-navigation";
import { DiscordLink } from "../ui/DiscordLink";
import { PatreonLink } from "../ui/PatreonLink";

export function SiteHeader({
  patreonEnabled = false,
  patreonConnected = false,
}: {
  patreonEnabled?: boolean;
  patreonConnected?: boolean;
}) {
  const pathname = usePathname();
  const memberLink = patreonConnected
    ? ROUTES.account
    : patreonConnectUrl(pathname);
  const memberLabel = patreonConnected ? "Patreon account" : "Connect Patreon";
  function preserveReturnLocation(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!patreonConnected)
      event.currentTarget.href = patreonConnectUrl(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
  }
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavigationRef = useRef<HTMLElement>(null);

  function closeMenu(restoreFocus = false) {
    setMenuOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  }

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = Array.from(
      mobileNavigationRef.current?.querySelectorAll<HTMLElement>("a[href]") ??
        [],
    );
    window.requestAnimationFrame(() => focusable[0]?.focus());
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu(true);
        return;
      }
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <>
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
              <small>D&amp;D Content &amp; Foundry Modules</small>
            </span>
          </Link>
          <nav className="header-nav" aria-label="Primary navigation">
            {PUBLIC_NAVIGATION.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            {patreonEnabled ? (
              <a
                className="nav-account"
                href={memberLink}
                onClick={preserveReturnLocation}
              >
                {memberLabel}
              </a>
            ) : null}
            <DiscordLink />
            <PatreonLink />
          </nav>
          <button
            ref={menuButtonRef}
            className="mobile-menu-button"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>
      {menuOpen ? (
        <button
          className="mobile-menu-backdrop open"
          type="button"
          aria-label="Dismiss navigation menu"
          onClick={() => closeMenu(true)}
        />
      ) : null}
      <nav
        ref={mobileNavigationRef}
        id="mobile-navigation"
        className={`mobile-navigation ${menuOpen ? "open" : ""}`}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        {PUBLIC_NAVIGATION.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => closeMenu()}>
            {item.label}
          </Link>
        ))}
        {patreonEnabled ? (
          <a
            href={memberLink}
            onClick={(event) => {
              preserveReturnLocation(event);
              closeMenu();
            }}
          >
            {memberLabel}
          </a>
        ) : null}
        <DiscordLink showLabel onClick={() => closeMenu()} />
        <PatreonLink showLabel onClick={() => closeMenu()} />
      </nav>
    </>
  );
}
