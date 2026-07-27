import { createTaxonomyEntry } from "../../../lib/repositories/taxonomy-repository";
import type { TaxonomyType } from "../../../lib/repositories/taxonomy-repository";
import { requireApiAdmin } from "../../../lib/services/auth";

const TYPES = ["author", "category", "system", "tag"] as const;

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const payload = (await request.json().catch(() => null)) as {
    type?: unknown;
    name?: unknown;
    slug?: unknown;
  } | null;
  const validation = validate(payload);
  if (!validation.ok) return validation.response;

  try {
    const id = await createTaxonomyEntry(validation.data);
    return Response.json({ id }, { status: 201 });
  } catch {
    return Response.json(
      { error: "The metadata entry could not be created." },
      { status: 500 },
    );
  }
}

export function validate(payload: {
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
