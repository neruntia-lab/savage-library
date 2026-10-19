import { useId, type MouseEventHandler, type ReactNode } from "react";

export function SocialLink({
  href,
  label,
  name,
  icon,
  showLabel = false,
  onClick,
}: {
  href: string;
  label: string;
  name: string;
  icon: ReactNode;
  showLabel?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const newTabDescriptionId = useId();
  return (
    <a
      className={`social-link ${name.toLowerCase()}-link${showLabel ? " social-link--label" : ""}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      aria-describedby={newTabDescriptionId}
      title={label}
      onClick={onClick}
    >
      {icon}
      {showLabel ? <span>{name}</span> : null}
      <span id={newTabDescriptionId} className="sr-only">
        Opens in a new tab.
      </span>
    </a>
  );
}
