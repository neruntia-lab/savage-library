import { readImage } from "../../../../lib/repositories/file-repository";

type RouteContext = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, context: RouteContext) {
  const { key } = await context.params;
  try {
    const image = await readImage(
      key.map((segment) => decodeURIComponent(segment)).join("/"),
    );
    if (!image || image.statusCode !== 200) {
      return new Response(null, { status: 404 });
    }
    const headers = new Headers();
    image.headers.forEach((value, key) => headers.set(key, value));
    headers.set("Cache-Control", "public, max-age=86400, immutable");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(image.stream, { headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}
