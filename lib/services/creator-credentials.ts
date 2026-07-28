import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../../db";
import { integrationCredentials } from "../../db/schema";

const CREDENTIAL_ID = "patreon-creator";

export async function storeCreatorCredentials(input: {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  scope?: string | null;
}) {
  const now = new Date().toISOString();
  await getDb()
    .insert(integrationCredentials)
    .values({
      id: CREDENTIAL_ID,
      accessTokenEncrypted: encrypt(input.accessToken),
      refreshTokenEncrypted: input.refreshToken ? encrypt(input.refreshToken) : null,
      expiresAt: input.expiresIn
        ? Math.floor(Date.now() / 1000) + input.expiresIn
        : null,
      scope: input.scope ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: integrationCredentials.id,
      set: {
        accessTokenEncrypted: encrypt(input.accessToken),
        refreshTokenEncrypted: input.refreshToken ? encrypt(input.refreshToken) : null,
        expiresAt: input.expiresIn
          ? Math.floor(Date.now() / 1000) + input.expiresIn
          : null,
        scope: input.scope ?? null,
        updatedAt: now,
      },
    });
}

export async function getCreatorAccessToken() {
  if (isDatabaseConfigured()) {
    const row = (
      await getDb()
        .select()
        .from(integrationCredentials)
        .where(eq(integrationCredentials.id, CREDENTIAL_ID))
        .limit(1)
    )[0];
    if (row) {
      if (!row.expiresAt || row.expiresAt * 1000 > Date.now() + 60_000) {
        return decrypt(row.accessTokenEncrypted);
      }
      if (row.refreshTokenEncrypted) {
        const refreshed = await refresh(decrypt(row.refreshTokenEncrypted));
        if (refreshed) {
          await storeCreatorCredentials(refreshed);
          return refreshed.accessToken;
        }
      }
    }
  }
  return process.env.PATREON_CREATOR_ACCESS_TOKEN ?? null;
}

export async function storeWebhookCredentials(id: string, secret: string) {
  await getDb()
    .update(integrationCredentials)
    .set({
      webhookId: id,
      webhookSecretEncrypted: encrypt(secret),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(integrationCredentials.id, CREDENTIAL_ID));
}

export async function getWebhookSecret() {
  if (isDatabaseConfigured()) {
    const row = (
      await getDb()
        .select({ secret: integrationCredentials.webhookSecretEncrypted })
        .from(integrationCredentials)
        .where(eq(integrationCredentials.id, CREDENTIAL_ID))
        .limit(1)
    )[0];
    if (row?.secret) return decrypt(row.secret);
  }
  return process.env.PATREON_WEBHOOK_SECRET ?? null;
}

export async function getStoredWebhookId() {
  if (!isDatabaseConfigured()) return null;
  return (
    await getDb()
      .select({ id: integrationCredentials.webhookId })
      .from(integrationCredentials)
      .where(eq(integrationCredentials.id, CREDENTIAL_ID))
      .limit(1)
  )[0]?.id ?? null;
}

async function refresh(refreshToken: string) {
  const response = await fetch("https://www.patreon.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: required("PATREON_CLIENT_ID"),
      client_secret: required("PATREON_CLIENT_SECRET"),
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  return body.access_token
    ? {
        accessToken: body.access_token,
        refreshToken: body.refresh_token ?? refreshToken,
        expiresIn: body.expires_in,
        scope: body.scope,
      }
    : null;
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function decrypt(value: string) {
  const [iv, tag, encrypted] = value
    .split(".")
    .map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted credential.");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function key() {
  return createHash("sha256")
    .update(
      process.env.PATREON_TOKEN_ENCRYPTION_KEY ??
        process.env.AUTH_SECRET ??
        required("NEXTAUTH_SECRET"),
    )
    .digest();
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}
