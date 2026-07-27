import {
  getDownloadRecord,
  readStoredFile,
  recordDownload,
} from "../../../../lib/repositories/file-repository";
import {
  getAuthorizedUser,
} from "../../../../lib/services/auth";
import {
  enforceRateLimit,
  requestIdentifier,
} from "../../../../lib/services/rate-limit";

type RouteContext = { params: Promise<{ fileId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const identifier = requestIdentifier(request);
  const limit = await enforceRateLimit({
    scope: "download",
    identifier,
    limit: 30,
    windowSeconds: 60,
  });
  if (!limit.allowed) return limit.response;

  const { fileId } = await context.params;
  try {
    const record = await getDownloadRecord(fileId);
    if (!record) {
      return Response.json({ error: "File not found." }, { status: 404 });
    }

    const user = await getAuthorizedUser();
    if (record.file.isRestricted && !user) {
      return Response.json(
        { error: "Sign in to download this file." },
        { status: 401 },
      );
    }

    const stored = await readStoredFile(record.file.storageKey);
    if (!stored) {
      return Response.json(
        { error: "The file is temporarily unavailable." },
        { status: 404 },
      );
    }

    await recordDownload({
      resourceId: record.resource.id,
      fileId: record.file.id,
      user,
      visitorHash: user ? undefined : await hashVisitor(identifier, request),
    });

    const headers = new Headers();
    stored.writeHttpMetadata(headers);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${safeFilename(record.file.originalName)}"`,
    );
    headers.set("Content-Length", String(stored.size));
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(stored.body, { headers });
  } catch {
    return Response.json(
      { error: "The download could not be completed." },
      { status: 500 },
    );
  }
}

function safeFilename(value: string): string {
  return value.replace(/[\r\n"\\/]/g, "-").slice(0, 180);
}

async function hashVisitor(
  identifier: string,
  request: Request,
): Promise<string> {
  const source = `${identifier}|${request.headers.get("user-agent") ?? ""}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
