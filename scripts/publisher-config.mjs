export const PRODUCTION_ORIGIN = "https://savage-library.vercel.app";
export const CONFIG_FILE = "savage-library.json";
export const LINK_FILE = ".savage-library.json";

export function isAdminToken(value) { return /^sla_[0-9a-f]{64}$/i.test(value ?? ""); }
export function plainText(value) { return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
export function inferSystem(manifest) {
  const systems = manifest.relationships?.systems;
  if (Array.isArray(systems) && systems.length === 1 && typeof systems[0]?.id === "string") return systems[0].id.toLowerCase();
  return "system-agnostic";
}
export function createPublisherConfig(manifest) {
  const description = String(manifest.description ?? "").trim();
  return { schemaVersion: 1, resource: {
    slug: manifest.id, title: manifest.title, shortDescription: plainText(description).slice(0, 240), description,
    author: "neruntia-lab", category: "foundry-modules", system: inferSystem(manifest), tags: [],
    compatibilityStatus: "verified", pricing: "free", accessMode: "public", defaultLocale: "en",
    installationInstructions: "Install this module in Foundry VTT using the manifest URL shown on its Savage Library resource page.",
    ...(isExternalProjectUrl(manifest.url) ? { projectUrl: manifest.url } : {}),
  } };
}
export function validatePublisherConfig(value) {
  const errors = [];
  if (!value || value.schemaVersion !== 1 || !value.resource || typeof value.resource !== "object") errors.push("savage-library.json must use schemaVersion 1 and contain a resource object.");
  const resource = value?.resource ?? {};
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resource.slug ?? "")) errors.push("resource.slug must contain lowercase letters, numbers, and single hyphens.");
  for (const key of ["title", "shortDescription", "description", "author", "category", "system"]) if (typeof resource[key] !== "string" || !resource[key].trim()) errors.push(`resource.${key} is required.`);
  if (resource.tags !== undefined && !Array.isArray(resource.tags)) errors.push("resource.tags must be an array of taxonomy slugs.");
  if (resource.accessMode && !["public", "patreon"].includes(resource.accessMode)) errors.push("resource.accessMode must be public or patreon.");
  return errors;
}
export function distributionUrls(slug) { return { url: `${PRODUCTION_ORIGIN}/resources/${slug}`, manifest: `${PRODUCTION_ORIGIN}/api/foundry/modules/${slug}/module.json` }; }
function isExternalProjectUrl(value) { try { const url = new URL(value); return url.protocol === "https:" && url.origin !== PRODUCTION_ORIGIN; } catch { return false; } }
