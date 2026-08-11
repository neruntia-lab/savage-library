import { reconcilePatreon } from "../../../../lib/services/patreon-sync";
import { cleanExpiredOperationalRecords } from "../../../../lib/services/maintenance";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const synchronized = await reconcilePatreon();
    const maintenance = await cleanExpiredOperationalRecords();
    return Response.json({ ...synchronized, maintenance });
  } catch {
    return Response.json(
      { error: "Patreon reconciliation failed." },
      { status: 502 },
    );
  }
}
