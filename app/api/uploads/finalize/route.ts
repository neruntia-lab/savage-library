import { head } from "@vercel/blob";
import { publicMediaBlobToken } from "../../../../lib/config/blob";
import { getResourceArtworkState, recordResourceArtwork } from "../../../../lib/repositories/file-repository";
import { requireApiAdmin } from "../../../../lib/services/auth";
import { validateUploadMetadata } from "../../../../lib/validation/upload";

type ArtworkFinalizeBody = {
  resourceId?: unknown;
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
    (body.kind !== "cover" && body.kind !== "thumbnail" && body.kind !== "icon") ||
    body.locale !== "en" ||
    typeof body.resourceId !== "string" ||
    !body.resourceId ||
    typeof body.originalName !== "string" ||
    typeof body.mimeType !== "string" ||
    typeof body.sizeBytes !== "number" ||
    typeof body.url !== "string" ||
    typeof body.pathname !== "string"
  ) {
    return Response.json({ error: "Artwork metadata is incomplete." }, { status: 400 });
  }

  const expectedPrefix = `resource-artwork/${body.resourceId}/${body.kind}/`;
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

  const token = publicMediaBlobToken();
  if (!token) {
    return Response.json({ error: "Public artwork storage is not configured." }, { status: 503 });
  }

  try {
    const confirmedBlob = await head(body.url, { token });
    if (
      confirmedBlob.pathname !== body.pathname ||
      confirmedBlob.size !== body.sizeBytes ||
      confirmedBlob.contentType !== body.mimeType
    ) {
      throw new Error("The uploaded artwork could not be verified.");
    }
    const stored = await recordResourceArtwork({
      resourceId: body.resourceId,
      kind: body.kind,
      locale: "en",
      originalName: body.originalName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      extension: validation.extension,
      uploadedBy: auth.user.id,
      blob: { url: body.url, pathname: body.pathname },
    });
    const artwork = await getResourceArtworkState(stored.resourceId);
    if (!artwork) throw new Error("The saved artwork could not be confirmed.");
    return Response.json({
      resourceId: stored.resourceId,
      kind: body.kind,
      url: body.url,
      persisted: true,
      ...artwork,
    });
  } catch (error) {
    console.error("Resource artwork finalization failed", {
      resourceId: body.resourceId,
      kind: body.kind,
      error,
    });
    return Response.json(
      { error: error instanceof Error ? error.message : "Artwork could not be saved." },
      { status: 400 },
    );
  }
}
