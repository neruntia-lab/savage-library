export type ResourceArtwork = {
  iconUrl?: string | null;
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  useIconEverywhere?: boolean;
};

export function resolveResourceArtwork(artwork: ResourceArtwork) {
  const iconEverywhere = Boolean(
    artwork.useIconEverywhere && artwork.iconUrl,
  );
  return {
    heroArtworkUrl:
      artwork.iconUrl ?? artwork.coverUrl ?? "/logo.png",
    cardArtworkUrl: iconEverywhere
      ? artwork.iconUrl!
      : artwork.thumbnailUrl ?? "/savage-library-logo.svg",
  };
}
