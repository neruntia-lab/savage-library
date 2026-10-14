/** Only relative, same-origin return locations may survive an OAuth round trip. */
export function memberReturnPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "/account";
  try {
    const url = new URL(value, "https://savage-library.local");
    return url.origin === "https://savage-library.local"
      ? `${url.pathname}${url.search}${url.hash}`
      : "/account";
  } catch {
    return "/account";
  }
}

export function patreonConnectUrl(returnTo: string): string {
  return `/api/account/connect-patreon?returnTo=${encodeURIComponent(memberReturnPath(returnTo))}`;
}

export function memberLinkStateMatches(state: string | null, cookie: string | undefined, userId: string): boolean {
  return Boolean(state && cookie === `${state}:${userId}`);
}
