import { getDb, isDatabaseConfigured } from "../../../db";
import { syncStates } from "../../../db/schema";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return healthResponse("degraded", 503);
  }

  try {
    await getDb().select({ id: syncStates.id }).from(syncStates).limit(1);
    return healthResponse("ok", 200);
  } catch {
    return healthResponse("degraded", 503);
  }
}

function healthResponse(status: "ok" | "degraded", httpStatus: number) {
  return Response.json(
    { status, checkedAt: new Date().toISOString() },
    {
      status: httpStatus,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
