import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../../db";
import { rateLimits } from "../../db/schema";

export async function enforceRateLimit(input: {
  scope: "search" | "download" | "account" | "admin" | "preview";
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; response: Response }
> {
  const now = Date.now();
  const expiresAt = now + input.windowSeconds * 1_000;
  if (!isDatabaseConfigured()) {
    return { allowed: true, remaining: input.limit, resetAt: expiresAt };
  }

  const key = `${input.scope}:${await shortHash(input.identifier)}`;
  try {
    const rows = await getDb()
      .insert(rateLimits)
      .values({
        key,
        count: 1,
        windowStartedAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE WHEN ${rateLimits.expiresAt} <= ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
          windowStartedAt: sql`CASE WHEN ${rateLimits.expiresAt} <= ${now} THEN ${now} ELSE ${rateLimits.windowStartedAt} END`,
          expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} <= ${now} THEN ${expiresAt} ELSE ${rateLimits.expiresAt} END`,
        },
      })
      .returning({
        count: rateLimits.count,
        expiresAt: rateLimits.expiresAt,
      });

    const count = rows[0]?.count ?? 1;
    const resetAt = rows[0]?.expiresAt ?? expiresAt;
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
    return { allowed: true, remaining: input.limit, resetAt: expiresAt };
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
