import { createTaxonomyEntry } from "../../../lib/repositories/taxonomy-repository";
import { getCatalogFacets } from "../../../lib/repositories/resource-repository";
import { requireApiAdmin } from "../../../lib/services/auth";
import {
  taxonomyError,
  validateTaxonomy,
} from "../../../lib/validation/taxonomy";

export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  try {
    return Response.json({ facets: await getCatalogFacets() });
  } catch {
    return Response.json(
      { error: "Taxonomy could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const payload = (await request.json().catch(() => null)) as {
    type?: unknown;
    name?: unknown;
    slug?: unknown;
  } | null;
  const validation = validateTaxonomy(payload);
  if (!validation.ok) return validation.response;

  try {
    const id = await createTaxonomyEntry(validation.data);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: taxonomyError(error, "created") },
      { status: 500 },
    );
  }
}
