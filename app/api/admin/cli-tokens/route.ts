import { ADMIN_CLI_SCOPES, createAdminCliToken, listAdminCliTokens, type AdminCliScope } from "../../../../lib/repositories/admin-cli-token-repository";
import { requireApiAdmin } from "../../../../lib/services/auth";

export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  return Response.json({ tokens: await listAdminCliTokens() });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as { name?: unknown; scopes?: unknown; expiresAt?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const scopes = Array.isArray(body?.scopes) ? body.scopes.filter((scope): scope is AdminCliScope => typeof scope === "string" && ADMIN_CLI_SCOPES.includes(scope as AdminCliScope)) : [];
  const expiresValue = typeof body?.expiresAt === "string" && body.expiresAt ? Date.parse(body.expiresAt) : NaN;
  const expiresAt = Number.isFinite(expiresValue) ? new Date(expiresValue).toISOString() : null;
  if (!name || name.length > 120 || !scopes.length) return Response.json({ error: "Enter a token name and select at least one scope." }, { status: 400 });
  if (body?.expiresAt && !expiresAt) return Response.json({ error: "Expiration is invalid." }, { status: 400 });
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) return Response.json({ error: "Expiration must be in the future." }, { status: 400 });
  const created = await createAdminCliToken({ name, scopes, expiresAt, createdBy: auth.user.id });
  return Response.json({ ...created, warning: "Copy this token now. It will not be shown again." }, { status: 201 });
}
