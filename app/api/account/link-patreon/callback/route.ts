import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { accounts, patreonMembers } from "../../../../../db/schema";
import { requireApiUser } from "../../../../../lib/services/auth";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get("sl_patreon_link_state")?.value;
  const code = request.nextUrl.searchParams.get("code");
  if (!state || state !== expected || !code) {
    return Response.json({ error: "Invalid Patreon linking state." }, { status: 400 });
  }
  const callback = new URL("/api/account/link-patreon/callback", request.url).toString();
  const tokenResponse = await fetch("https://www.patreon.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.PATREON_CLIENT_ID ?? "",
      client_secret: process.env.PATREON_CLIENT_SECRET ?? "",
      redirect_uri: callback,
    }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) {
    return Response.json({ error: "Patreon linking failed." }, { status: 502 });
  }
  const token = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };
  const identityResponse = await fetch(
    "https://www.patreon.com/api/oauth2/v2/identity",
    { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" },
  );
  if (!identityResponse.ok) {
    return Response.json({ error: "Patreon identity could not be verified." }, { status: 502 });
  }
  const identity = (await identityResponse.json()) as { data?: { id?: string } };
  const patreonUserId = identity.data?.id;
  if (!patreonUserId) return Response.json({ error: "Missing Patreon identity." }, { status: 502 });
  const existing = (
    await getDb()
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(and(eq(accounts.provider, "patreon"), eq(accounts.providerAccountId, patreonUserId)))
      .limit(1)
  )[0];
  if (existing && existing.userId !== auth.user.id) {
    return Response.json({ error: "That Patreon account is already linked." }, { status: 409 });
  }
  if (!existing) {
    await getDb().insert(accounts).values({
      userId: auth.user.id,
      type: "oauth",
      provider: "patreon",
      providerAccountId: patreonUserId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (token.expires_in ?? 2_592_000),
      token_type: token.token_type,
      scope: token.scope,
    });
  }
  await getDb()
    .update(patreonMembers)
    .set({ websiteUserId: auth.user.id, updatedAt: new Date().toISOString() })
    .where(eq(patreonMembers.patreonUserId, patreonUserId));
  const response = NextResponse.redirect(new URL("/account?patreon=linked", request.url));
  response.cookies.delete("sl_patreon_link_state");
  return response;
}
