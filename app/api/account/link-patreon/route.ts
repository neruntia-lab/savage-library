import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../lib/services/auth";
import { patreonMemberConnectionsEnabled } from "../../../../lib/config/patreon-members";
import { patreonConnectionsPausedResponse } from "../../../../lib/services/patreon-member-connections";
import { memberReturnPath } from "../../../../lib/config/member-navigation";

export async function GET(request: Request) {
  if (!patreonMemberConnectionsEnabled())
    return patreonConnectionsPausedResponse();
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (auth.user.isAdmin)
    return Response.json(
      {
        error:
          "Sign out of the administrator account before connecting a member account.",
      },
      { status: 403 },
    );
  const state = randomBytes(24).toString("base64url");
  const callback = new URL(
    "/api/account/link-patreon/callback",
    request.url,
  ).toString();
  const target = new URL("https://www.patreon.com/oauth2/authorize");
  target.searchParams.set("response_type", "code");
  target.searchParams.set("client_id", process.env.PATREON_CLIENT_ID ?? "");
  target.searchParams.set("redirect_uri", callback);
  target.searchParams.set("scope", "identity identity.memberships");
  target.searchParams.set("state", state);
  const response = NextResponse.redirect(target);
  response.cookies.set("sl_patreon_link_state", `${state}:${auth.user.id}`, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/api/account/link-patreon/callback",
    maxAge: 10 * 60,
  });
  response.cookies.set(
    "sl_patreon_link_return",
    memberReturnPath(new URL(request.url).searchParams.get("returnTo")),
    {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/api/account/link-patreon/callback",
      maxAge: 10 * 60,
    },
  );
  return response;
}
