import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "../../../../../lib/services/auth";
import {
  storeCreatorCredentials,
  getStoredWebhookId,
  storeWebhookCredentials,
} from "../../../../../lib/services/creator-credentials";

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get("sl_patreon_creator_state")?.value;
  const code = request.nextUrl.searchParams.get("code");
  if (!state || state !== expected || !code) {
    return Response.json({ error: "Invalid Patreon authorization state." }, { status: 400 });
  }
  const callback = new URL("/api/admin/patreon/callback", request.url).toString();
  const response = await fetch("https://www.patreon.com/api/oauth2/token", {
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
  if (!response.ok) {
    return Response.json({ error: "Patreon authorization failed." }, { status: 502 });
  }
  const body = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  await storeCreatorCredentials({
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in,
    scope: body.scope,
  });
  await registerWebhook(body.access_token, request);
  const redirect = NextResponse.redirect(new URL("/admin?patreon=connected", request.url));
  redirect.cookies.delete("sl_patreon_creator_state");
  return redirect;
}

async function registerWebhook(accessToken: string, request: Request) {
  const existingId = await getStoredWebhookId();
  const response = await fetch(
    `https://www.patreon.com/api/oauth2/v2/webhooks${existingId ? `/${encodeURIComponent(existingId)}` : ""}`,
    {
    method: existingId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        ...(existingId ? { id: existingId } : {}),
        type: "webhook",
        attributes: {
          triggers: [
            "members:create",
            "members:update",
            "members:delete",
            "posts:publish",
            "posts:update",
            "posts:delete",
          ],
          uri: new URL("/api/patreon/webhook", request.url).toString(),
        },
        relationships: {
          campaign: {
            data: {
              type: "campaign",
              id: process.env.PATREON_CAMPAIGN_ID,
            },
          },
        },
      },
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Patreon webhook registration failed.");
  const body = (await response.json()) as {
    data?: { id?: string; attributes?: { secret?: string } };
  };
  if (body.data?.id && body.data.attributes?.secret) {
    await storeWebhookCredentials(body.data.id, body.data.attributes.secret);
  }
}
