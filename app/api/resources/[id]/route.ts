import {
  getAdminResource,
  setResourcePublication,
  updateResource,
} from "../../../../lib/repositories/resource-repository";
import { deleteResourceAndFiles } from "../../../../lib/services/resource-admin";
import { requireApiAdmin } from "../../../../lib/services/auth";
import { validateResourceInput } from "../../../../lib/validation/resource";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    const resource = await getAdminResource(id);
    return resource
      ? Response.json({ resource })
      : Response.json({ error: "Resource not found." }, { status: 404 });
  } catch {
    return Response.json(
      { error: "The resource could not be loaded." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const validation = validateResourceInput(payload);
  if (!validation.success) {
    return Response.json({ errors: validation.errors }, { status: 400 });
  }

  try {
    const updated = await updateResource(id, validation.data);
    return updated
      ? Response.json({ id })
      : Response.json({ error: "Resource not found." }, { status: 404 });
  } catch {
    return Response.json(
      { error: "The resource could not be updated." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as {
    isPublished?: unknown;
  } | null;
  if (typeof payload?.isPublished !== "boolean") {
    return Response.json(
      { error: "Publication state is required." },
      { status: 400 },
    );
  }

  try {
    if (payload.isPublished) {
      const resource = await getAdminResource(id);
      if (!resource) {
        return Response.json({ error: "Resource not found." }, { status: 404 });
      }
      const validation = validateResourceInput({
        ...resource,
        isPublished: true,
      });
      if (!validation.success) {
        return Response.json(
          {
            error: "Complete the required content fields before publishing.",
            errors: validation.errors,
          },
          { status: 400 },
        );
      }
    }
    const updated = await setResourcePublication(id, payload.isPublished);
    return updated
      ? Response.json({ id, isPublished: payload.isPublished })
      : Response.json({ error: "Resource not found." }, { status: 404 });
  } catch (error) {
    console.error("Resource publication failed", { resourceId: id, error });
    return Response.json(
      { error: "Publication state could not be changed." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    const deleted = await deleteResourceAndFiles(id);
    return deleted
      ? new Response(null, { status: 204 })
      : Response.json({ error: "Resource not found." }, { status: 404 });
  } catch {
    return Response.json(
      { error: "The resource could not be deleted." },
      { status: 500 },
    );
  }
}
