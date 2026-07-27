import { readImage } from "../../../../lib/repositories/file-repository";

type RouteContext = { params: Promise<{ key: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { key } = await context.params;
  try {
    const image = await readImage(decodeURIComponent(key));
    if (!image) return new Response(null, { status: 404 });
    const headers = new Headers();
    image.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=86400, immutable");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(image.body, { headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}
