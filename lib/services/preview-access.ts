import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const PREVIEW_ACCESS_COOKIE = "sl_preview_access";
export const PREVIEW_ACCESS_SECONDS = 24 * 60 * 60;

export type PreviewAccessState =
  | { configured: true; authorized: boolean }
  | { configured: false; authorized: false };

export function isPreviewAccessConfigured(): boolean {
  return Boolean(
    process.env.PREVIEW_PASSWORD_HASH && process.env.PREVIEW_ACCESS_SECRET,
  );
}

export async function getPreviewAccessState(): Promise<PreviewAccessState> {
  if (!isPreviewAccessConfigured()) {
    return { configured: false, authorized: false };
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(PREVIEW_ACCESS_COOKIE)?.value;
  return {
    configured: true,
    authorized: verifyPreviewAccessToken(
      token,
      process.env.PREVIEW_ACCESS_SECRET!,
    ),
  };
}

export function createPreviewAccessToken(
  secret: string,
  now = Date.now(),
): { token: string; expiresAt: Date } {
  const expiresAt = new Date(now + PREVIEW_ACCESS_SECONDS * 1_000);
  const payload = Buffer.from(String(expiresAt.getTime())).toString("base64url");
  return {
    token: `${payload}.${signature(payload, secret)}`,
    expiresAt,
  };
}

export function verifyPreviewAccessToken(
  token: string | null | undefined,
  secret: string,
  now = Date.now(),
): boolean {
  if (!token || !secret) return false;
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra) return false;

  const expectedSignature = signature(payload, secret);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return false;
  }

  try {
    const expiresAt = Number(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return Number.isSafeInteger(expiresAt) && expiresAt > now;
  } catch {
    return false;
  }
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
