import { requireApiAdmin } from "../../../../../lib/services/auth";
import {
  listPatreonTiers,
  syncPatreonTiers,
} from "../../../../../lib/services/patreon";

export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  return Response.json({ tiers: await listPatreonTiers() });
}

export async function POST() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  try {
    const count = await syncPatreonTiers();
    return Response.json({ count, tiers: await listPatreonTiers() });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Patreon tiers could not be synchronized.",
      },
      { status: 502 },
    );
  }
}
