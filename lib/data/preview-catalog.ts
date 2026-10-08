import { isLocalPreview } from "../config/local-preview";
import { SEED_RESOURCES } from "./seed-resources";

/** Opt-in stress fixtures exist only in the credential-free local preview. */
export function previewCatalog() {
  const size = Number(process.env.SAVAGE_LIBRARY_PREVIEW_CATALOG_SIZE);
  if (!isLocalPreview() || !Number.isInteger(size) || size < 1)
    return SEED_RESOURCES;
  return Array.from({ length: Math.min(size, 10000) }, (_, i) => ({
    ...SEED_RESOURCES[i % SEED_RESOURCES.length],
    id: `preview-${String(i + 1).padStart(5, "0")}`,
    slug: `preview-resource-${i + 1}`,
    title: `Preview resource ${i + 1}`,
  }));
}
