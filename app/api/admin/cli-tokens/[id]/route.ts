import { revokeAdminCliToken } from "../../../../../lib/repositories/admin-cli-token-repository";
import { requireApiAdmin } from "../../../../../lib/services/auth";

type Context = { params: Promise<{ id: string }> };
export async function DELETE(request: Request, context: Context) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
  const revoked = await revokeAdminCliToken(id, typeof body?.reason === "string" ? body.reason : "Revoked by administrator");
  return revoked ? Response.json({ ok: true }) : Response.json({ error: "Active token not found." }, { status: 404 });
}
