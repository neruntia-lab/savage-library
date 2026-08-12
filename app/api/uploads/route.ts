import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { privateBlobToken } from "../../../lib/config/blob";
import { recordUploadedBlob } from "../../../lib/repositories/file-repository";
import type { FileKind } from "../../../lib/domain/resource";
import { requireApiAdmin } from "../../../lib/services/auth";
import {
  maximumUploadBytesForKind,
  uploadRulesForKind,
  validateUploadMetadata,
} from "../../../lib/validation/upload";

const ALLOWED_KINDS = [
  "pdf",
  "module",
  "macro",
  "cover",
  "thumbnail",
  "icon",
  "descriptionImage",
  "manifest",
] as const;

type UploadPayload = {
  resourceVersionId: string;
  resourceId?: string;
  kind: FileKind;
  locale: "en" | "es";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  extension: string;
  uploadedBy: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return Response.json({ error: "Invalid upload request." }, { status: 400 });
  }

  let authenticatedAdminId: string | null = null;
  if (body.type === "blob.generate-client-token") {
    const auth = await requireApiAdmin();
    if (!auth.ok) return auth.response;
    authenticatedAdminId = auth.user.id;
  }

  const payloadSource =
    body.type === "blob.generate-client-token"
      ? body.payload.clientPayload
      : body.payload.tokenPayload;
  const parsed = parseUploadPayload(payloadSource);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const payload = {
    ...parsed.value,
    uploadedBy: authenticatedAdminId ?? parsed.value.uploadedBy,
  };
  const isMedia =
    payload.kind === "cover" ||
    payload.kind === "thumbnail" ||
    payload.kind === "icon" ||
    payload.kind === "descriptionImage";
  const token = isMedia
    ? process.env.PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN
    : privateBlobToken();
  if (!token) {
    return Response.json(
      { error: "The selected file storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const response = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname) => {
        const artworkKind = payload.kind === "cover" || payload.kind === "thumbnail" || payload.kind === "icon";
        const expectedPrefix = artworkKind && payload.resourceId
          ? `resource-artwork/${payload.resourceId}/${payload.kind}/`
          : `resource-files/${payload.resourceVersionId}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("The upload path is invalid.");
        }
        return {
          allowedContentTypes: [...uploadRulesForKind(payload.kind).mimeTypes],
          maximumSizeInBytes: maximumUploadBytesForKind(payload.kind),
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const completed = parseUploadPayload(tokenPayload);
        if (!completed.ok) throw new Error(completed.error);
        if (["cover", "thumbnail", "icon"].includes(completed.value.kind)) return;
        await recordUploadedBlob({
          ...completed.value,
          blob,
        });
      },
    });
    return Response.json(response);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "The upload could not complete.",
      },
      { status: 400 },
    );
  }
}

function parseUploadPayload(
  source: string | null | undefined,
): { ok: true; value: UploadPayload } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(source ?? "");
  } catch {
    return { ok: false, error: "Upload metadata is invalid." };
  }
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Upload metadata is invalid." };
  }

  const input = value as Record<string, unknown>;
  const kind = input.kind;
  const locale = input.locale;
  const isArtwork = kind === "cover" || kind === "thumbnail" || kind === "icon";
  if (
    typeof kind !== "string" ||
    !ALLOWED_KINDS.includes(kind as FileKind) ||
    (locale !== "en" && locale !== "es") ||
    typeof input.resourceVersionId !== "string" ||
    !input.resourceVersionId ||
    typeof input.originalName !== "string" ||
    typeof input.mimeType !== "string" ||
    typeof input.sizeBytes !== "number" ||
    typeof input.uploadedBy !== "string" ||
    (isArtwork && (typeof input.resourceId !== "string" || !input.resourceId))
  ) {
    return { ok: false, error: "Upload metadata is incomplete." };
  }

  const validation = validateUploadMetadata({
    name: input.originalName,
    type: input.mimeType,
    size: input.sizeBytes,
    kind: kind as FileKind,
  });
  if (!validation.valid) return { ok: false, error: validation.message };

  return {
    ok: true,
    value: {
      resourceVersionId: input.resourceVersionId.slice(0, 160),
      resourceId:
        typeof input.resourceId === "string" && input.resourceId
          ? input.resourceId.slice(0, 160)
          : undefined,
      kind: kind as FileKind,
      locale,
      originalName: input.originalName.slice(0, 255),
      mimeType: input.mimeType.slice(0, 160),
      sizeBytes: input.sizeBytes,
      extension: validation.extension,
      uploadedBy: input.uploadedBy.slice(0, 160),
    },
  };
}
