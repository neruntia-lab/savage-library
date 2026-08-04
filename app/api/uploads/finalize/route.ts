import { recordUploadedBlob } from "../../../../lib/repositories/file-repository";
import { requireApiAdmin } from "../../../../lib/services/auth";
import { validateUploadMetadata } from "../../../../lib/validation/upload";

type ArtworkFinalizeBody = {
  resourceVersionId?: unknown;
  kind?: unknown;
  locale?: unknown;
  originalName?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
  url?: unknown;
  pathname?: unknown;
};

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as ArtworkFinalizeBody | null;
  if (
    !body ||
    (body.kind !== "cover" && body.kind !== "thumbnail") ||
    body.locale !== "en" ||
    typeof body.resourceVersionId !== "string" ||
    !body.resourceVersionId ||
    typeof body.originalName !== "string" ||
    typeof body.mimeType !== "string" ||
    typeof body.sizeBytes !== "number" ||
    typeof body.url !== "string" ||
    typeof body.pathname !== "string"
  ) {
    return Response.json({ error: "Artwork metadata is incomplete." }, { status: 400 });
  }

  const expectedPrefix = `resource-files/${body.resourceVersionId}/`;
  let uploadUrl: URL;
  try {
    uploadUrl = new URL(body.url);
  } catch {
    return Response.json({ error: "Artwork URL is invalid." }, { status: 400 });
  }
  if (
    uploadUrl.protocol !== "https:" ||
    !uploadUrl.hostname.endsWith(".public.blob.vercel-storage.com") ||
    !body.pathname.startsWith(expectedPrefix)
  ) {
    return Response.json({ error: "Artwork upload destination is invalid." }, { status: 400 });
  }

  const validation = validateUploadMetadata({
    name: body.originalName,
    type: body.mimeType,
    size: body.sizeBytes,
    kind: body.kind,
  });
  if (!validation.valid) {
    return Response.json({ error: validation.message }, { status: 400 });
  }

  try {
    const stored = await recordUploadedBlob({
      resourceVersionId: body.resourceVersionId,
      kind: body.kind,
      locale: "en",
      originalName: body.originalName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      extension: validation.extension,
      uploadedBy: auth.user.id,
      blob: { url: body.url, pathname: body.pathname },
    });
    return Response.json(stored);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Artwork could not be saved." },
      { status: 400 },
    );
  }
}
