import {
  authenticatePublisherToken,
  createReleaseDraft,
  listModuleReleases,
} from "../../../../../../lib/repositories/publisher-repository";
import { requireApiAdmin } from "../../../../../../lib/services/auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  return Response.json({ releases: await listModuleReleases(id) });
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  let uploadedBy = "publisher-cli";
  let source: "admin" | "cli" = "cli";
  if (!bearer || !(await authenticatePublisherToken(id, bearer))) {
    const auth = await requireApiAdmin();
    if (!auth.ok) return auth.response;
    uploadedBy = auth.user.id;
    source = "admin";
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "A module ZIP is required." }, { status: 400 });
    }
    const release = await createReleaseDraft({
      resourceId: id,
      file,
      source,
      uploadedBy,
    });
    return Response.json(
      {
        release,
        reviewUrl: `/admin/resources/${id}#module-releases`,
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Release upload failed." },
      { status: 400 },
    );
  }
}
