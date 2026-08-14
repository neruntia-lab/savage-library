import {
  getPublisherReleaseStatus,
  PublisherVerificationError,
} from "../../../../../lib/repositories/publisher-repository";

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return publisherError("publisher_token_invalid", 401, "A publisher token is required.");
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (
    !body ||
    typeof body.resourceId !== "string" ||
    typeof body.moduleId !== "string" ||
    typeof body.version !== "string" ||
    typeof body.checksum !== "string"
  ) {
    return publisherError("invalid_request", 400, "Release status metadata is invalid.");
  }
  try {
    const result = await getPublisherReleaseStatus({
      resourceId: body.resourceId.slice(0, 160),
      token: bearer,
      moduleId: body.moduleId.slice(0, 160),
      version: body.version.slice(0, 80),
      checksum: body.checksum.slice(0, 128),
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PublisherVerificationError) {
      return publisherError(error.code, error.status, error.message);
    }
    return publisherError("verification_failed", 500, "Release status verification failed.");
  }
}

function publisherError(code: string, status: number, message: string) {
  return Response.json({ ok: false, code, error: message }, { status });
}
