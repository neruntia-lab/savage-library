import { setSavedResource } from "../../../lib/repositories/account-repository";
import { requireApiUser } from "../../../lib/services/auth";
import {
  enforceRateLimit,
  requestIdentifier,
} from "../../../lib/services/rate-limit";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const limit = await enforceRateLimit({
    scope: "account",
    identifier: auth.user.id || requestIdentifier(request),
    limit: 60,
    windowSeconds: 60,
  });
  if (!limit.allowed) return limit.response;

  const payload = (await request.json().catch(() => null)) as {
    resourceId?: unknown;
    saved?: unknown;
  } | null;
  if (
    !payload ||
    typeof payload.resourceId !== "string" ||
    payload.resourceId.length > 120 ||
    typeof payload.saved !== "boolean"
  ) {
    return Response.json({ error: "Invalid save request." }, { status: 400 });
  }

  try {
    await setSavedResource(auth.user, payload.resourceId, payload.saved);
    return Response.json({ saved: payload.saved });
  } catch {
    return Response.json(
      { error: "The saved resource could not be updated." },
      { status: 500 },
    );
  }
}
