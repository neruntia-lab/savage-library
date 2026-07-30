import { requireApiAdmin } from "../../../../../lib/services/auth";
import { reconcilePatreon } from "../../../../../lib/services/patreon-sync";

export async function POST() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  try {
    return Response.json(await reconcilePatreon());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Synchronization failed." },
      { status: 502 },
    );
  }
}
