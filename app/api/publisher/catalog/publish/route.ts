import { publishPublisherCatalogRelease } from "../../../../../lib/repositories/publisher-catalog-repository";
import { requireAdminCliToken } from "../../../../../lib/services/admin-cli-auth";

export async function POST(request: Request) {
  const auth = await requireAdminCliToken(request, ["publish"]);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as { resourceId?: unknown; releaseId?: unknown } | null;
  if (typeof body?.resourceId !== "string" || typeof body.releaseId !== "string") return Response.json({ ok: false, code: "invalid_request", error: "Resource and release ids are required." }, { status: 400 });
  try { return Response.json({ ok: true, ...(await publishPublisherCatalogRelease(body.resourceId, body.releaseId)) }); }
  catch (error) { return Response.json({ ok: false, code: "publish_failed", error: error instanceof Error ? error.message : "Publication failed." }, { status: 400 }); }
}
