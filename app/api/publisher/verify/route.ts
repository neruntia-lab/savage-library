import {
  PublisherVerificationError,
  verifyPublisherConfiguration,
} from "../../../../lib/repositories/publisher-repository";

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return publisherError("publisher_token_invalid", 401, "A publisher token is required.");

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (
    !body ||
    typeof body.resourceId !== "string" ||
    typeof body.moduleId !== "string" ||
    (body.version != null && typeof body.version !== "string") ||
    (body.checksum != null && typeof body.checksum !== "string") ||
    (body.sizeBytes != null &&
      (typeof body.sizeBytes !== "number" || body.sizeBytes <= 0 || body.sizeBytes > 250 * 1024 * 1024))
  ) {
    return publisherError("invalid_request", 400, "Publisher verification metadata is invalid.");
  }

  try {
    const resource = await verifyPublisherConfiguration({
      resourceId: body.resourceId.slice(0, 160),
      token: bearer,
      moduleId: body.moduleId.slice(0, 160),
      version: typeof body.version === "string" ? body.version.slice(0, 80) : undefined,
      checksum: typeof body.checksum === "string" ? body.checksum.slice(0, 128) : undefined,
    });
    return Response.json({ ok: true, resource });
  } catch (error) {
    if (error instanceof PublisherVerificationError) {
      return publisherError(error.code, error.status, error.message);
    }
    return publisherError("verification_failed", 500, "Publisher verification failed.");
  }
}

function publisherError(code: string, status: number, message: string) {
  return Response.json({ ok: false, code, error: message }, { status });
}
