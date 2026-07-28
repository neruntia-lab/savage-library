import {
  createManualGrant,
  listMemberships,
} from "../../../../lib/repositories/membership-repository";
import { requireApiAdmin } from "../../../../lib/services/auth";
import { sendComplimentaryInvite } from "../../../../lib/services/magic-link";

export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  return Response.json(await listMemberships());
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    tierIds?: string[];
    expiresAt?: string | null;
    reason?: string;
    internalNote?: string;
  } | null;
  if (
    !body?.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
    !Array.isArray(body.tierIds) ||
    !body.tierIds.length
  ) {
    return Response.json({ error: "Email and at least one tier are required." }, { status: 400 });
  }
  const result = await createManualGrant({
    email: body.email,
    tierIds: body.tierIds.filter((id): id is string => typeof id === "string"),
    expiresAt: body.expiresAt,
    reason: body.reason,
    internalNote: body.internalNote,
    grantedBy: auth.user.id,
  });
  const invitationSent = await sendComplimentaryInvite(result.email).catch(
    () => false,
  );
  return Response.json({ ...result, invitationSent }, { status: 201 });
}
