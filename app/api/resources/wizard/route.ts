import { RESOURCE_TYPES, type ResourceType } from "../../../../lib/domain/resource";
import {
  createResource,
  getCatalogFacets,
  resourceSlugExists,
  setResourceSetupState,
} from "../../../../lib/repositories/resource-repository";
import { requireApiAdmin } from "../../../../lib/services/auth";
import {
  createWizardDraftInput,
  wizardSlug,
} from "../../../../lib/services/resource-wizard";

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof payload?.title === "string" ? payload.title.trim().slice(0, 120) : "";
  const generatedSlug = wizardSlug(
    typeof payload?.slug === "string" && payload.slug.trim() ? payload.slug : title,
  );
  const resourceType = payload?.resourceType;
  const defaultLocale = payload?.defaultLocale === "es" ? "es" : "en";
  if (title.length < 2)
    return Response.json({ errors: { title: "Enter a title with at least two characters." } }, { status: 400 });
  if (!RESOURCE_TYPES.includes(resourceType as ResourceType))
    return Response.json({ errors: { resourceType: "Choose a content type." } }, { status: 400 });
  if (!generatedSlug)
    return Response.json({ errors: { slug: "Enter a valid URL slug." } }, { status: 400 });
  if (await resourceSlugExists(generatedSlug))
    return Response.json({ errors: { slug: "That URL slug is already in use." } }, { status: 409 });
  try {
    const draft = createWizardDraftInput({
      title,
      slug: generatedSlug,
      resourceType: resourceType as ResourceType,
      defaultLocale,
      facets: await getCatalogFacets(),
    });
    const id = await createResource(draft);
    await setResourceSetupState(id, { status: "in_progress", step: 2 });
    return Response.json({ id, step: 2 }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The draft could not be created." },
      { status: 500 },
    );
  }
}
