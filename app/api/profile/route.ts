import { updateProfile } from "../../../lib/repositories/account-repository";
import { requireApiUser } from "../../../lib/services/auth";

export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const payload = (await request.json().catch(() => null)) as {
    displayName?: unknown;
  } | null;
  const displayName =
    typeof payload?.displayName === "string"
      ? payload.displayName.replace(/\u0000/g, "").trim()
      : "";
  if (displayName.length < 2 || displayName.length > 80) {
    return Response.json(
      { error: "Display name must be 2–80 characters." },
      { status: 400 },
    );
  }

  try {
    await updateProfile(auth.user, displayName);
    return Response.json({ displayName });
  } catch {
    return Response.json(
      { error: "The profile could not be updated." },
      { status: 500 },
    );
  }
}
