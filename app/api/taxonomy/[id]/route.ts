import {
  deleteTaxonomyEntry,
  updateTaxonomyEntry,
  type TaxonomyType,
} from "../../../../lib/repositories/taxonomy-repository";
import { requireApiAdmin } from "../../../../lib/services/auth";
import {
  taxonomyError,
  validateTaxonomy,
} from "../../../../lib/validation/taxonomy";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const payload = (await request.json().catch(() => null)) as {
    type?: unknown;
    name?: unknown;
    slug?: unknown;
  } | null;
  const validation = validateTaxonomy(payload);
  if (!validation.ok) return validation.response;
  const { id } = await context.params;

  try {
    const updated = await updateTaxonomyEntry({ id, ...validation.data });
    return updated
      ? Response.json({ id })
      : Response.json({ error: "Metadata not found." }, { status: 404 });
  } catch (error) {
    return Response.json(
      { error: taxonomyError(error, "updated") },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const type = new URL(request.url).searchParams.get("type") as TaxonomyType;
  if (!["author", "category", "system", "tag"].includes(type)) {
    return Response.json({ error: "Invalid metadata type." }, { status: 400 });
  }
  const { id } = await context.params;

  try {
    const deleted = await deleteTaxonomyEntry(type, id);
    return deleted
      ? new Response(null, { status: 204 })
      : Response.json({ error: "Metadata not found." }, { status: 404 });
  } catch {
    return Response.json(
      { error: "Metadata is in use and cannot be deleted." },
      { status: 409 },
    );
  }
}
