import { NextResponse } from "next/server";
import { getAuthorizedUser } from "../../../../lib/services/auth";
import { patreonMemberConnectionsEnabled } from "../../../../lib/config/patreon-members";
import { memberReturnPath } from "../../../../lib/config/member-navigation";
import { patreonConnectionsPausedResponse } from "../../../../lib/services/patreon-member-connections";

export async function GET(request: Request) {
  if (!patreonMemberConnectionsEnabled())
    return patreonConnectionsPausedResponse();
  const returnTo = memberReturnPath(
    new URL(request.url).searchParams.get("returnTo"),
  );
  const user = await getAuthorizedUser();
  const destination = user
    ? `/api/account/link-patreon?returnTo=${encodeURIComponent(returnTo)}`
    : `/account?returnTo=${encodeURIComponent(returnTo)}`;
  return NextResponse.redirect(new URL(destination, request.url), {
    headers: { "Cache-Control": "no-store" },
  });
}
