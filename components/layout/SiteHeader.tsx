"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ROUTES, PUBLIC_NAVIGATION } from "../../lib/config/site";

export function SiteHeader() {
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
      </nav>
    </>
  );
}
