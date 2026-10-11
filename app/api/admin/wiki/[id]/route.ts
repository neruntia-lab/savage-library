import { requireApiAdmin } from "../../../../../lib/services/auth";
import {
  getAdminWiki,
  saveWiki,
} from "../../../../../lib/repositories/wiki-repository";
import { wikiApiError } from "../../../../../lib/services/wiki-api";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  try {
    const guide = await getAdminWiki((await params).id);
    return guide
      ? Response.json({ guide }, { headers: { "Cache-Control": "no-store" } })
      : Response.json({ error: "Guide not found." }, { status: 404 });
  } catch (error) {
    return wikiApiError(error);
  }
}
export async function PUT(request: Request, { params }: Context) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  try {
    const id = (await params).id;
    if (!(await getAdminWiki(id)))
      return Response.json({ error: "Guide not found." }, { status: 404 });
    return Response.json({
      guide: await saveWiki(
        await request.json().catch(() => null),
        auth.user.id,
        id,
      ),
    });
  } catch (error) {
    return wikiApiError(error);
  }
}
