import { NextResponse } from "next/server";

export function patreonConnectionsPausedResponse() {
  const response = NextResponse.json(
    {
      error: "New Patreon connections are temporarily unavailable.",
      code: "patreon_connections_paused",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set("sl_patreon_link_state", "", {
    path: "/api/account/link-patreon/callback",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });
  return response;
}
