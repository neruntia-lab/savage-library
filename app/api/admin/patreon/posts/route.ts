import {
  approveImportCandidate,
  listImportCandidates,
  updateImportCandidate,
} from "../../../../../lib/repositories/import-candidate-repository";
import { requireApiAdmin } from "../../../../../lib/services/auth";
import { syncPostById } from "../../../../../lib/services/patreon-sync";
import type { PatreonImportPayload } from "../../../../../lib/services/patreon-posts";

export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  return Response.json({ candidates: await listImportCandidates() });
}

export async function PATCH(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    action?: "save" | "approve" | "reject" | "reprocess";
    payload?: PatreonImportPayload;
    resourceId?: string | null;
  } | null;
  if (!body?.id) {
    return Response.json({ error: "Candidate ID is required." }, { status: 400 });
  }
  try {
    if (body.action === "reprocess") {
      await syncPostById(body.id);
    } else if (body.action === "approve") {
      if (body.payload || body.resourceId !== undefined) {
        await updateImportCandidate(body.id, {
          payload: body.payload,
          resourceId: body.resourceId,
          status: "pending",
        });
      }
      const resourceId = await approveImportCandidate(body.id);
      return Response.json({ updated: true, resourceId });
    } else {
      const updated = await updateImportCandidate(body.id, {
        payload: body.payload,
        resourceId: body.resourceId,
        status: body.action === "reject" ? "rejected" : "pending",
      });
      if (!updated) {
        return Response.json({ error: "Candidate not found." }, { status: 404 });
      }
    }
    return Response.json({ updated: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Candidate update failed." },
      { status: 400 },
    );
  }
}
