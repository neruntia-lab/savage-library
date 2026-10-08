import { NextResponse } from "next/server";
import {
  createSignedDownloadUrl,
  recordDownload,
} from "../../../../../../../../lib/repositories/file-repository";
import { getPublicFoundryArtifact } from "../../../../../../../../lib/repositories/publisher-repository";
import {
  prepareTrackedDownload,
  downloadErrorResponse,
} from "../../../../../../../../lib/services/download-delivery";

type Context = { params: Promise<{ slug: string; releaseId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { slug, releaseId } = await context.params;
    const record = await getPublicFoundryArtifact(slug, releaseId);
    if (!record)
      return Response.json({ error: "Release not found." }, { status: 404 });
    const signedUrl = await prepareTrackedDownload({
      createUrl: () => createSignedDownloadUrl(record.file.storageKey),
      track: request.method === "GET",
      record: () =>
        recordDownload({
          resourceId: record.resource.id,
          fileId: record.file.id,
          visitorHash: "foundry-updater",
        }),
    });
    const response = NextResponse.redirect(signedUrl, 302);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return downloadErrorResponse(error);
  }
}

export const HEAD = GET;
