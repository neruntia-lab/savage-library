import { NextResponse } from "next/server";
import { createSignedDownloadUrl, recordDownload } from "../../../../../../../../lib/repositories/file-repository";
import { getPublicFoundryArtifact } from "../../../../../../../../lib/repositories/publisher-repository";

type Context = { params: Promise<{ slug: string; releaseId: string }> };

export async function GET(_: Request, context: Context) {
  const { slug, releaseId } = await context.params;
  const record = await getPublicFoundryArtifact(slug, releaseId);
  if (!record) return Response.json({ error: "Release not found." }, { status: 404 });
  await recordDownload({
    resourceId: record.resource.id,
    fileId: record.file.id,
    visitorHash: "foundry-updater",
  });
  return NextResponse.redirect(await createSignedDownloadUrl(record.file.storageKey), 302);
}
