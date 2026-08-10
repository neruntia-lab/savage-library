import {
  publishRelease,
  rejectRelease,
  rollbackRelease,
  updateReleaseDraft,
} from "../../../../../../../lib/repositories/publisher-repository";
import { requireApiAdmin } from "../../../../../../../lib/services/auth";
import { CANONICAL_SITE_ORIGIN } from "../../../../../../../lib/config/site";

type Context = { params: Promise<{ id: string; releaseId: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id, releaseId } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  try {
    const action = body.action;
    if (action === "publish") {
      await publishRelease(id, releaseId, CANONICAL_SITE_ORIGIN);
    }
    else if (action === "reject") await rejectRelease(id, releaseId);
    else if (action === "rollback") await rollbackRelease(id, releaseId);
    else {
      const updated = await updateReleaseDraft(id, releaseId, {
        foundryMinimum: stringValue(body.foundryMinimum),
        foundryVerified: stringValue(body.foundryVerified),
        foundryMaximum: stringValue(body.foundryMaximum),
        summary: stringValue(body.summary),
        details: stringValue(body.details),
        releasedAt: stringValue(body.releasedAt),
      });
      if (!updated) return Response.json({ error: "Draft release not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Release update failed." },
      { status: 400 },
    );
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
