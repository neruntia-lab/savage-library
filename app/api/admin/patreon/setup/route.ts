import { requireApiAdmin } from "../../../../../lib/services/auth";
import {
  registerCreatorWebhook,
  storeCreatorCredentials,
} from "../../../../../lib/services/creator-credentials";
import { reconcilePatreon } from "../../../../../lib/services/patreon-sync";
import { CANONICAL_SITE_ORIGIN } from "../../../../../lib/config/site";

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const accessToken = process.env.PATREON_CREATOR_ACCESS_TOKEN;
  if (!accessToken) {
    return Response.json(
      {
        error:
          "PATREON_CREATOR_ACCESS_TOKEN must be added to this Vercel environment.",
      },
      { status: 503 },
    );
  }
  const campaignId = process.env.PATREON_CAMPAIGN_ID;
  if (!campaignId) {
    return Response.json(
      { error: "PATREON_CAMPAIGN_ID must be configured." },
      { status: 503 },
    );
  }
  try {
    const validation = await fetch(
      `https://www.patreon.com/api/oauth2/v2/campaigns/${encodeURIComponent(campaignId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!validation.ok) {
      throw new Error(
        `The creator token cannot access campaign ${campaignId} (${validation.status}).`,
      );
    }
    await storeCreatorCredentials({
      accessToken,
      refreshToken: process.env.PATREON_CREATOR_REFRESH_TOKEN,
      expiresIn: process.env.PATREON_CREATOR_REFRESH_TOKEN
        ? 28 * 24 * 60 * 60
        : null,
      scope: "creator",
    });
    const origin =
      process.env.VERCEL_ENV === "production"
        ? CANONICAL_SITE_ORIGIN
        : process.env.NEXT_PUBLIC_SITE_URL ??
          process.env.NEXTAUTH_URL ??
          new URL(request.url).origin;
    const webhookId = await registerCreatorWebhook(accessToken, origin);
    const synchronized = await reconcilePatreon();
    return Response.json({ connected: true, webhookId, ...synchronized });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Patreon creator setup failed.",
      },
      { status: 502 },
    );
  }
}
