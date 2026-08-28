import {
  getAdminResource,
  resourceSlugExists,
  setResourceSetupState,
  updateResource,
} from "../../../../../lib/repositories/resource-repository";
import { requireApiAdmin } from "../../../../../lib/services/auth";
import { getResourcePublicationChecks, publishResourceWithDelivery } from "../../../../../lib/services/resource-publication";
import { validateResourceInput } from "../../../../../lib/validation/resource";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const resource = await getAdminResource(id).catch(() => null);
  return resource
    ? Response.json({ resource, checks: await checksFor(resource) })
    : Response.json({ error: "Resource not found." }, { status: 404 });
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as { resource?: unknown; step?: unknown } | null;
  const validation = validateResourceInput({ ...(payload?.resource as object), isPublished: false });
  if (!validation.success) return Response.json({ errors: validation.errors }, { status: 400 });
  if (await resourceSlugExists(validation.data.slug, id))
    return Response.json({ errors: { slug: "That URL slug is already in use." } }, { status: 409 });
  const step = typeof payload?.step === "number" ? payload.step : 2;
  const updated = await updateResource(id, validation.data);
  if (!updated) return Response.json({ error: "Resource not found." }, { status: 404 });
  await setResourceSetupState(id, { status: "in_progress", step });
  const resource = await getAdminResource(id);
  return Response.json({ id, step, checks: resource ? await checksFor(resource) : [] });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as { resource?: unknown; publish?: unknown } | null;
  const publish = payload?.publish === true;
  const validation = validateResourceInput({ ...(payload?.resource as object), isPublished: publish });
  if (!validation.success) return Response.json({ errors: validation.errors }, { status: 400 });
  const savedInput = { ...validation.data, isPublished: false };
  await updateResource(id, savedInput);
  const resource = await getAdminResource(id);
  if (!resource) return Response.json({ error: "Resource not found." }, { status: 404 });
  const checks = await checksFor(resource);
  const required = checks.filter((check) => check.level === "required");
  if (publish && required.length)
    return Response.json({ error: "Resolve the required items before publishing.", checks }, { status: 400 });

  if (publish) {
    await publishResourceWithDelivery(id);
  }
  await setResourceSetupState(id, { status: "complete", step: 6 });
  return Response.json({ id, published: publish });
}

async function checksFor(resource: Awaited<ReturnType<typeof getAdminResource>>) {
  if (!resource) return [];
  return (await getResourcePublicationChecks(resource.id))?.checks ?? [];
}
