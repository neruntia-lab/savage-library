import { requireAdminCliToken } from "../../../../../lib/services/admin-cli-auth";

export async function POST(request: Request) {
  const auth = await requireAdminCliToken(request);
  if (!auth.ok) return auth.response;
  return Response.json({ ok: true, credential: auth.credential });
}
