import { rotatePublisherToken } from "../../../../../../lib/repositories/publisher-repository";
import { requireApiAdmin } from "../../../../../../lib/services/auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: Context) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const token = await rotatePublisherToken(id);
  return Response.json({
    token,
    warning: "Copy this token now. It will not be shown again.",
  });
}
