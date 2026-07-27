import { storeResourceFile } from "../../../lib/repositories/file-repository";
import type { FileKind } from "../../../lib/domain/resource";
import { requireApiAdmin } from "../../../lib/services/auth";
import { enforceRateLimit } from "../../../lib/services/rate-limit";
import {
  MAX_UPLOAD_BYTES,
  validateUpload,
} from "../../../lib/validation/upload";

const ALLOWED_KINDS = [
  "pdf",
  "module",
  "cover",
  "thumbnail",
  "manifest",
] as const;

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES + 1_000_000) {
    return Response.json(
      { error: "The upload exceeds the 50 MB limit." },
      { status: 413 },
    );
  }

  const limit = await enforceRateLimit({
    scope: "admin",
    identifier: auth.user.id,
    limit: 30,
    windowSeconds: 60,
  });
  if (!limit.allowed) return limit.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const kind = formData?.get("kind");
  const resourceVersionId = formData?.get("resourceVersionId");

  if (
    !(file instanceof File) ||
    typeof kind !== "string" ||
    !ALLOWED_KINDS.includes(kind as FileKind) ||
    typeof resourceVersionId !== "string" ||
    resourceVersionId.length > 160
  ) {
    return Response.json(
      { error: "A valid file, kind, and resource version are required." },
      { status: 400 },
    );
  }

  const validation = validateUpload(file, kind as FileKind);
  if (!validation.valid) {
    return Response.json({ error: validation.message }, { status: 400 });
  }

  try {
    const stored = await storeResourceFile({
      resourceVersionId,
      kind: kind as FileKind,
      file,
      extension: validation.extension,
      uploadedBy: auth.user,
    });
    return Response.json(stored, { status: 201 });
  } catch {
    return Response.json(
      { error: "The file could not be stored." },
      { status: 500 },
    );
  }
}
