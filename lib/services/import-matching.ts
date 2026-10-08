type MatchableResource = {
  id: string;
  slug: string;
  title: string;
  manifestUrl: string | null;
  projectUrl: string | null;
};
type ImportIdentity = {
  resourceKey?: string;
  title: string;
  manifestUrl?: string;
  projectUrl?: string;
};

/** One index per reconciliation, rather than re-reading the catalog for every post. */
export function createImportMatcher(resources: MatchableResource[]) {
  const slugs = new Map(resources.map((r) => [r.slug, r.id]));
  const index = (key: (r: MatchableResource) => string | null) => {
    const entries = new Map<string, string[]>();
    for (const r of resources) {
      const value = key(r);
      if (value) entries.set(value, [...(entries.get(value) ?? []), r.id]);
    }
    return entries;
  };
  const manifests = index((r) => normalizedUrl(r.manifestUrl));
  const projects = index((r) => normalizedUrl(r.projectUrl));
  const titles = index((r) => normalizedTitle(r.title));
  return (payload: ImportIdentity) => {
    const explicit = payload.resourceKey
      ? slugs.get(payload.resourceKey)
      : null;
    if (explicit) return { resourceId: explicit, matchedBy: "resource_key" };
    for (const [entries, value, matchedBy] of [
      [manifests, normalizedUrl(payload.manifestUrl), "manifest_url"],
      [projects, normalizedUrl(payload.projectUrl), "project_url"],
      [titles, normalizedTitle(payload.title), "title"],
    ] as const) {
      const ids = value ? entries.get(value) : undefined;
      if (ids?.length)
        return {
          resourceId: ids.length === 1 ? ids[0] : null,
          matchedBy: ids.length === 1 ? matchedBy : `ambiguous_${matchedBy}`,
        };
    }
    return { resourceId: null, matchedBy: null };
  };
}

function normalizedUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}
function normalizedTitle(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}
