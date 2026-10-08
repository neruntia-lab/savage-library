export type ResourceArtwork = {
  iconUrl?: string | null;
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  useIconEverywhere?: boolean;
};

// Wiki cards accept public media only; never serialize private Blob locations.
export function publicWikiArtworkUrl(value?: string | null): string | null {
  if (!value) return null;
  if (value === "/logo.png" || value === "/savage-library-logo.svg")
    return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i.test(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function resolveResourceArtwork(artwork: ResourceArtwork) {
  const iconEverywhere = Boolean(artwork.useIconEverywhere && artwork.iconUrl);
  return {
    heroArtworkUrl: artwork.iconUrl ?? artwork.coverUrl ?? "/logo.png",
    cardArtworkUrl: iconEverywhere
      ? artwork.iconUrl!
      : (artwork.thumbnailUrl ?? "/savage-library-logo.svg"),
  };
}
