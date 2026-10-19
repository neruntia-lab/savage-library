import type { MouseEventHandler } from "react";
import { SocialLink } from "./SocialLink";

export const PATREON_PAGE_URL = "https://www.patreon.com/cw/SavageLibrary";

export function PatreonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* Patreon glyph from Simple Icons (CC0); kept inline to avoid a dependency. */}
      <path d="M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604C2.357 3.231 1.093 7.391 1.046 11.54c-.039 3.411.302 12.396 5.369 12.46 3.765.047 4.326-4.804 6.068-7.141 1.24-1.662 2.836-2.132 4.801-2.618 3.376-.836 5.678-3.501 5.673-7.031Z" />
    </svg>
  );
}

export function PatreonLink({
  showLabel = false,
  onClick,
}: {
  showLabel?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <SocialLink
      href={PATREON_PAGE_URL}
      label="Support Savage Library on Patreon"
      name="Patreon"
      icon={<PatreonIcon />}
      showLabel={showLabel}
      onClick={onClick}
    />
  );
}
