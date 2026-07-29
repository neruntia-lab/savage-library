import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import {
  manualGrants,
  manualGrantTiers,
  patreonMemberTiers,
  patreonMembers,
  patreonTiers,
  users,
} from "../../db/schema";

export async function listMemberships() {
  const [memberRows, grantRows, tierRows] = await Promise.all([
    getDb().select().from(patreonMembers).orderBy(patreonMembers.displayName),
    getDb()
      .select({
        grant: manualGrants,
        email: users.email,
        name: users.name,
      })
      .from(manualGrants)
      .innerJoin(users, eq(users.id, manualGrants.userId))
      .orderBy(desc(manualGrants.createdAt)),
    getDb().select().from(patreonTiers).orderBy(patreonTiers.amountCents),
  ]);
  const memberTierRows = memberRows.length
    ? await getDb()
        .select()
        .from(patreonMemberTiers)
        .where(inArray(patreonMemberTiers.memberId, memberRows.map((m) => m.id)))
    : [];
  const grantTierRows = grantRows.length
    ? await getDb()
        .select()
        .from(manualGrantTiers)
        .where(inArray(manualGrantTiers.grantId, grantRows.map((g) => g.grant.id)))
    : [];
  return {
    tiers: tierRows,
    members: memberRows.map((member) => ({
      ...member,
      source: "patreon" as const,
      tierIds: memberTierRows
        .filter((row) => row.memberId === member.id)
        .map((row) => row.tierId),
    })),
    grants: grantRows.map(({ grant, email, name }) => ({
      ...grant,
      status:
        grant.status === "active" &&
        grant.expiresAt &&
        grant.expiresAt <= new Date().toISOString()
          ? "expired"
          : grant.status,
      email,
      displayName: name ?? email ?? "Complimentary member",
      source: "complimentary" as const,
      tierIds: grantTierRows
        .filter((row) => row.grantId === grant.id)
        .map((row) => row.tierId),
    })),
  };
}

export async function createManualGrant(input: {
  email: string;
  tierIds: string[];
  expiresAt?: string | null;
  reason?: string;
  internalNote?: string;
  grantedBy: string;
}) {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  let user = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  const now = new Date().toISOString();
  if (!user) {
    user = (
      await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          email,
          name: email.split("@")[0],
          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )[0];
  }
  const id = crypto.randomUUID();
  await db.insert(manualGrants).values({
    id,
    userId: user.id,
    status: "active",
    reason: input.reason?.trim() ?? "",
    internalNote: input.internalNote?.trim() ?? "",
    grantedBy: input.grantedBy,
    expiresAt: input.expiresAt || null,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(manualGrantTiers).values(
    input.tierIds.map((tierId) => ({ grantId: id, tierId })),
  );
  return { id, userId: user.id, email };
}

export async function revokeManualGrant(id: string, reason = "manual_revoke") {
  const now = new Date().toISOString();
  const rows = await getDb()
    .update(manualGrants)
    .set({
      status: "revoked",
      revokedAt: now,
      revocationReason: reason,
      updatedAt: now,
    })
    .where(and(eq(manualGrants.id, id), eq(manualGrants.status, "active")))
    .returning({ id: manualGrants.id });
  return Boolean(rows[0]);
}

export async function updateManualGrant(
  id: string,
  input: { tierIds: string[]; expiresAt?: string | null; reason?: string; internalNote?: string },
) {
  const db = getDb();
  const rows = await db
    .update(manualGrants)
    .set({
      expiresAt: input.expiresAt || null,
      ...(input.reason !== undefined ? { reason: input.reason.trim() } : {}),
      ...(input.internalNote !== undefined
        ? { internalNote: input.internalNote.trim() }
        : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(manualGrants.id, id), eq(manualGrants.status, "active")))
    .returning({ id: manualGrants.id });
  if (!rows[0]) return false;
  await db.delete(manualGrantTiers).where(eq(manualGrantTiers.grantId, id));
  await db.insert(manualGrantTiers).values(
    input.tierIds.map((tierId) => ({ grantId: id, tierId })),
  );
  return true;
}

export async function getGrantEmail(id: string) {
  return (
    await getDb()
      .select({ email: users.email })
      .from(manualGrants)
      .innerJoin(users, eq(users.id, manualGrants.userId))
      .where(eq(manualGrants.id, id))
      .limit(1)
  )[0]?.email ?? null;
}

export async function getAccountMembership(userId: string) {
  const db = getDb();
  const [memberRows, grantRows] = await Promise.all([
    db
      .select({
        active: patreonMembers.isActive,
        tierId: patreonMemberTiers.tierId,
        lastSyncedAt: patreonMembers.lastSyncedAt,
      })
      .from(patreonMembers)
      .leftJoin(
        patreonMemberTiers,
        eq(patreonMemberTiers.memberId, patreonMembers.id),
      )
      .where(eq(patreonMembers.websiteUserId, userId)),
    db
      .select({
        status: manualGrants.status,
        expiresAt: manualGrants.expiresAt,
        tierId: manualGrantTiers.tierId,
      })
      .from(manualGrants)
      .leftJoin(
        manualGrantTiers,
        eq(manualGrantTiers.grantId, manualGrants.id),
      )
      .where(eq(manualGrants.userId, userId))
      .orderBy(desc(manualGrants.createdAt)),
  ]);
  const activePatreon = memberRows.some((row) => row.active);
  const now = new Date().toISOString();
  const grant = grantRows.find(
    (row) =>
      row.status === "active" &&
      (!row.expiresAt || row.expiresAt > now),
  );
  const tierIds = activePatreon
    ? memberRows.flatMap((row) => (row.tierId ? [row.tierId] : []))
    : grantRows
        .filter(
          (row) =>
            row.status === "active" &&
            (!row.expiresAt || row.expiresAt > now),
        )
        .flatMap((row) => (row.tierId ? [row.tierId] : []));
  const tierNames = tierIds.length
    ? await db
        .select({ id: patreonTiers.id, title: patreonTiers.title })
        .from(patreonTiers)
        .where(inArray(patreonTiers.id, tierIds))
    : [];
  return {
    source: activePatreon ? "patreon" : grant ? "complimentary" : "none",
    tiers: tierNames.map((tier) => tier.title),
    expiresAt: activePatreon ? null : grant?.expiresAt ?? null,
    lastVerifiedAt: memberRows[0]?.lastSyncedAt ?? null,
  };
}
