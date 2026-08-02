import { publicManifest, type FoundryManifest } from "../../../../../../lib/foundry/publisher";
import { getActiveFoundryRelease } from "../../../../../../lib/repositories/publisher-repository";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: Context) {
  const { slug } = await context.params;
  const record = await getActiveFoundryRelease(slug);
  if (!record) return Response.json({ error: "Module not found." }, { status: 404 });
  const snapshot = JSON.parse(record.release.manifestSnapshot ?? "{}") as FoundryManifest;
  snapshot.version = record.release.version;
  snapshot.compatibility = {
    ...(record.release.foundryMinimum
      ? { minimum: record.release.foundryMinimum }
      : {}),
    ...(record.release.foundryVerified
      ? { verified: record.release.foundryVerified }
      : {}),
    ...(record.release.foundryMaximum
      ? { maximum: record.release.foundryMaximum }
      : {}),
  };
  const manifest = publicManifest(snapshot, {
    baseUrl: new URL(request.url).origin,
    slug,
    versionId: record.release.id,
    description:
      record.resource.description ||
      record.resource.shortDescription ||
      record.resource.title,
    authorName: record.author.name,
  });
  return Response.json(manifest, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "Content-Disposition": 'inline; filename="module.json"',
      "Access-Control-Allow-Origin": "*",
    },
  });
}
