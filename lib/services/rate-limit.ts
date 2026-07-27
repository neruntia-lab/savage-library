import { ensureDatabaseSchema } from "../../db/bootstrap";
import { getDatabaseBinding } from "../platform/bindings";

export async function enforceRateLimit(input: {
  scope: "search" | "download" | "account" | "admin";
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; response: Response }
> {
  const database = getDatabaseBinding();
  if (!database) {
    return {
      allowed: true,
      remaining: input.limit,
      resetAt: Date.now() + input.windowSeconds * 1_000,
    };
  }

  const now = Date.now();
  const expiresAt = now + input.windowSeconds * 1_000;
  const key = `${input.scope}:${await shortHash(input.identifier)}`;

  try {
    await ensureDatabaseSchema();
    const row = await database
      .prepare(
        `INSERT INTO rate_limits (key, count, window_started_at, expires_at)
         VALUES (?, 1, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           count = CASE WHEN rate_limits.expires_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
           window_started_at = CASE WHEN rate_limits.expires_at <= ? THEN ? ELSE rate_limits.window_started_at END,
           expires_at = CASE WHEN rate_limits.expires_at <= ? THEN ? ELSE rate_limits.expires_at END
         RETURNING count, expires_at`,
      )
      .bind(key, now, expiresAt, now, now, now, now, expiresAt)
      .first<{ count: number; expires_at: number }>();

    const count = row?.count ?? 1;
    const resetAt = row?.expires_at ?? expiresAt;
    if (count > input.limit) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1_000));
      return {
        allowed: false,
        response: Response.json(
          { error: "Too many requests. Try again shortly." },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfter) },
          },
        ),
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, input.limit - count),
      resetAt,
    };
  } catch {
    return {
      allowed: true,
      remaining: input.limit,
      resetAt: expiresAt,
    };
  }
}

export function requestIdentifier(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous"
  );
}

async function shortHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
