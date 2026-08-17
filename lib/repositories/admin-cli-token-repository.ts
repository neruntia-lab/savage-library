import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { adminCliTokens } from "../../db/schema";
import { hashPublisherToken } from "../foundry/publisher";

export const ADMIN_CLI_SCOPES = [
  "resource:create",
  "resource:update",
  "publish",
] as const;
export type AdminCliScope = (typeof ADMIN_CLI_SCOPES)[number];

export async function createAdminCliToken(input: {
  name: string;
  scopes: AdminCliScope[];
  createdBy: string;
  expiresAt?: string | null;
}) {
  const token = `sla_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await getDb().insert(adminCliTokens).values({
    id,
    name: input.name.slice(0, 120),
    tokenPrefix: token.slice(0, 12),
    tokenHash: await hashPublisherToken(token),
    scopes: JSON.stringify(Array.from(new Set(input.scopes))),
    createdBy: input.createdBy,
    expiresAt: input.expiresAt || null,
    createdAt: now,
    updatedAt: now,
  });
  return { id, token };
}

export async function listAdminCliTokens() {
  const rows = await getDb()
    .select({
      id: adminCliTokens.id,
      name: adminCliTokens.name,
      tokenPrefix: adminCliTokens.tokenPrefix,
      scopes: adminCliTokens.scopes,
      expiresAt: adminCliTokens.expiresAt,
      lastUsedAt: adminCliTokens.lastUsedAt,
      revokedAt: adminCliTokens.revokedAt,
      revocationReason: adminCliTokens.revocationReason,
      createdAt: adminCliTokens.createdAt,
    })
    .from(adminCliTokens)
    .orderBy(desc(adminCliTokens.createdAt));
  return rows.map((row) => ({
    ...row,
    scopes: parseScopes(row.scopes),
  }));
}

export async function revokeAdminCliToken(id: string, reason: string) {
  const now = new Date().toISOString();
  const rows = await getDb()
    .update(adminCliTokens)
    .set({ revokedAt: now, revocationReason: reason.slice(0, 500), updatedAt: now })
    .where(and(eq(adminCliTokens.id, id), isNull(adminCliTokens.revokedAt)))
    .returning({ id: adminCliTokens.id });
  return Boolean(rows[0]);
}

export async function authenticateAdminCliToken(
  token: string,
  requiredScopes: AdminCliScope[] = [],
) {
  if (!/^sla_[0-9a-f]{64}$/i.test(token)) return null;
  const hash = await hashPublisherToken(token);
  const rows = await getDb()
    .select()
    .from(adminCliTokens)
    .where(eq(adminCliTokens.tokenHash, hash))
    .limit(1);
  const row = rows[0];
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && Date.parse(row.expiresAt) <= Date.now()) return null;
  const scopes = parseScopes(row.scopes);
  if (requiredScopes.some((scope) => !scopes.includes(scope))) return null;
  await getDb()
    .update(adminCliTokens)
    .set({ lastUsedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(adminCliTokens.id, row.id));
  return { id: row.id, name: row.name, scopes };
}

function parseScopes(value: string): AdminCliScope[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((scope): scope is AdminCliScope =>
          ADMIN_CLI_SCOPES.includes(scope as AdminCliScope),
        )
      : [];
  } catch {
    return [];
  }
}
