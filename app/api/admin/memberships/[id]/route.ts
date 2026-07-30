import {
  getGrantEmail,
  revokeManualGrant,
  updateManualGrant,
} from "../../../../../lib/repositories/membership-repository";
import { requireApiAdmin } from "../../../../../lib/services/auth";
import { sendComplimentaryInvite } from "../../../../../lib/services/magic-link";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  return (await revokeManualGrant(id))
    ? Response.json({ revoked: true })
    : Response.json({ error: "Active grant not found." }, { status: 404 });
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    tierIds?: string[];
    expiresAt?: string | null;
    reason?: string;
    internalNote?: string;
  } | null;
  if (!body?.tierIds?.length) {
    return Response.json({ error: "At least one tier is required." }, { status: 400 });
  }
  return (await updateManualGrant(id, {
    tierIds: body.tierIds,
    expiresAt: body.expiresAt,
    reason: body.reason,
    internalNote: body.internalNote,
  }))
    ? Response.json({ updated: true })
    : Response.json({ error: "Active grant not found." }, { status: 404 });
}

export async function POST(_request: Request, context: Context) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const email = await getGrantEmail(id);
  if (!email) return Response.json({ error: "Grant not found." }, { status: 404 });
  const sent = await sendComplimentaryInvite(email).catch(() => false);
  return sent
    ? Response.json({ sent: true })
    : Response.json({ error: "Email delivery is not configured." }, { status: 503 });
}
