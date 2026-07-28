import {
  listAdminPosts,
  updateAdminPost,
} from "../../../../../lib/repositories/post-repository";
import { requireApiAdmin } from "../../../../../lib/services/auth";
import { syncPostById } from "../../../../../lib/services/patreon-sync";

export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  return Response.json({ posts: await listAdminPosts() });
}

export async function PATCH(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    isPublished?: boolean;
    resourceId?: string | null;
    resync?: boolean;
  } | null;
  if (!body?.id) return Response.json({ error: "Post ID is required." }, { status: 400 });
  if (body.resync) await syncPostById(body.id);
  const changed =
    body.isPublished !== undefined || body.resourceId !== undefined
      ? await updateAdminPost(body.id, {
          ...(body.isPublished !== undefined
            ? { isPublished: body.isPublished }
            : {}),
          ...(body.resourceId !== undefined
            ? { resourceId: body.resourceId || null }
            : {}),
        })
      : true;
  return changed
    ? Response.json({ updated: true })
    : Response.json({ error: "Post not found." }, { status: 404 });
}
