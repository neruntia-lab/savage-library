import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "../../../../../lib/services/auth";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const state = randomBytes(24).toString("base64url");
  const callback = new URL("/api/admin/patreon/callback", request.url).toString();
  const target = new URL("https://www.patreon.com/oauth2/authorize");
  target.searchParams.set("response_type", "code");
  target.searchParams.set("client_id", process.env.PATREON_CLIENT_ID ?? "");
  target.searchParams.set("redirect_uri", callback);
  target.searchParams.set(
    "scope",
    "campaigns campaigns.posts campaigns.members w:campaigns.webhook",
  );
  target.searchParams.set("state", state);
  const response = NextResponse.redirect(target);
  response.cookies.set("sl_patreon_creator_state", state, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/api/admin/patreon/callback",
    maxAge: 10 * 60,
  });
  return response;
}
