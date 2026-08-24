import { attachPublisherReleaseNotes } from "../../../../../lib/repositories/publisher-repository";
import { requireAdminCliToken } from "../../../../../lib/services/admin-cli-auth";

export async function POST(request: Request) {
  const auth = await requireAdminCliToken(request, ["resource:update"]);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as {
    resourceId?: unknown;
    releaseId?: unknown;
    version?: unknown;
    release?: unknown;
  } | null;
  if (
    typeof body?.resourceId !== "string" ||
    typeof body.releaseId !== "string" ||
    typeof body.version !== "string"
  ) {
    return Response.json(
      { ok: false, code: "invalid_request", error: "Resource, release, and version identifiers are required." },
      { status: 400 },
    );
  }
  try {
    const result = await attachPublisherReleaseNotes({
      resourceId: body.resourceId,
      releaseId: body.releaseId,
      version: body.version,
      release: body.release,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { ok: false, code: "release_notes_invalid", error: error instanceof Error ? error.message : "Patch notes could not be saved." },
      { status: 400 },
    );
  }
}
