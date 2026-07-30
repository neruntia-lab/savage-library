import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { accounts } from "../../db/schema";

export async function getLinkedPatreonAccessToken(userId: string) {
  const account = (
    await getDb()
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.provider, "patreon")))
      .limit(1)
  )[0];
  if (!account?.access_token) return null;
  if (!account.expires_at || account.expires_at * 1000 > Date.now() + 60_000) {
    return account.access_token;
  }
  if (!account.refresh_token) return null;
  const response = await fetch("https://www.patreon.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      client_id: process.env.PATREON_CLIENT_ID ?? "",
      client_secret: process.env.PATREON_CLIENT_SECRET ?? "",
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) return null;
  await getDb()
    .update(accounts)
    .set({
      access_token: body.access_token,
      refresh_token: body.refresh_token ?? account.refresh_token,
      expires_at:
        Math.floor(Date.now() / 1000) + (body.expires_in ?? 2_592_000),
    })
    .where(
      and(
        eq(accounts.provider, "patreon"),
        eq(accounts.providerAccountId, account.providerAccountId),
      ),
    );
  return body.access_token;
}
