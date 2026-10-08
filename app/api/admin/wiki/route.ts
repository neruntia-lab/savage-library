import { requireApiAdmin } from "../../../../lib/services/auth";
import {
  listAdminWiki,
  saveWiki,
} from "../../../../lib/repositories/wiki-repository";
import { wikiApiError } from "../../../../lib/services/wiki-api";

export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  try {
    return Response.json(
      { guides: await listAdminWiki() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return wikiApiError(error);
  }
}
export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  try {
    return Response.json(
      {
        guide: await saveWiki(
          await request.json().catch(() => null),
          auth.user.id,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return wikiApiError(error);
  }
}
