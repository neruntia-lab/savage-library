import { WikiError } from "./wiki";

export function wikiApiError(error: unknown) {
  if (error instanceof WikiError)
    return Response.json(
      { error: error.message, errors: error.errors },
      { status: error.status },
    );
  const cause =
    (error as { cause?: { code?: string }; code?: string })?.cause ??
    (error as { code?: string });
  if (cause?.code === "23505")
    return Response.json(
      {
        error: "That guide slug is already in use.",
        errors: { slug: "Choose a unique slug." },
      },
      { status: 409 },
    );
  return Response.json(
    {
      error:
        "Wiki storage is unavailable. Check the development database connection and apply the Wiki migration, then retry.",
    },
    { status: 503 },
  );
}
