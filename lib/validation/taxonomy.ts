import type { TaxonomyType } from "../repositories/taxonomy-repository";

const TYPES = ["author", "category", "system", "tag"] as const;

export function validateTaxonomy(payload: {
  type?: unknown;
  name?: unknown;
  slug?: unknown;
} | null):
  | {
      ok: true;
      data: { type: TaxonomyType; name: string; slug: string };
    }
  | { ok: false; response: Response } {
  const type = payload?.type;
  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  const slug = typeof payload?.slug === "string" ? payload.slug.trim() : "";
  if (
    typeof type !== "string" ||
    !TYPES.includes(type as TaxonomyType) ||
    name.length < 2 ||
    name.length > 120 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    return {
      ok: false,
      response: Response.json(
        { error: "Enter a valid type, name, and lowercase URL slug." },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: { type: type as TaxonomyType, name, slug } };
}

export function taxonomyError(error: unknown, action: "created" | "updated") {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("unique") || message.includes("duplicate")) {
    return "That taxonomy slug is already in use.";
  }
  return `The taxonomy entry could not be ${action}.`;
}
