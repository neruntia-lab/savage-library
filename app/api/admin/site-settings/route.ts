import { requireApiAdmin } from "../../../../lib/services/auth";
import { getSiteAppearanceFromDatabase } from "../../../../lib/repositories/site-settings-repository";

export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;

  try {
    return Response.json(await getSiteAppearanceFromDatabase());
  } catch {
    return Response.json(
      { error: "Appearance settings could not be loaded." },
      { status: 503 },
    );
  }
}
