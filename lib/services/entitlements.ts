import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb, isDatabaseConfigured } from "../../db";
import {
  manualGrants,
  manualGrantTiers,
  patreonTiers,
} from "../../db/schema";
import type { AuthorizedUser } from "./auth";
import { getPatreonAccessToken } from "./auth";
import { verifyPatreonEntitlement } from "./patreon";
import { getLinkedPatreonAccessToken } from "./linked-patreon";

export type EntitlementResult = {
  entitled: boolean;
  tierIds: string[];
  source: "patreon" | "complimentary" | "admin" | "none";
  verifiedAt: string;
  expiresAt: string | null;
  denialReason?: "signed_out" | "no_qualifying_tier" | "verification_unavailable";
};

export async function resolveEntitlement(input: {
  user: AuthorizedUser | null;
  request?: NextRequest;
  requiredTierIds: string[];
  allowAnyPaidTier?: boolean;
}): Promise<EntitlementResult> {
  const verifiedAt = new Date().toISOString();
  if (!input.user) {
    return {
      entitled: false,
      tierIds: [],
      source: "none",
      verifiedAt,
      expiresAt: null,
      denialReason: "signed_out",
    };
  }
  if (input.user.isAdmin) {
    return {
      entitled: true,
      tierIds: input.requiredTierIds,
      source: "admin",
      verifiedAt,
      expiresAt: null,
    };
  }

  let liveUnavailable = false;
  if (input.request) {
    const accessToken =
      (await getPatreonAccessToken(input.request)) ??
      (isDatabaseConfigured()
        ? await getLinkedPatreonAccessToken(input.user.id)
        : null);
    if (accessToken) {
      try {
        const allowedIds =
          input.requiredTierIds.length || !input.allowAnyPaidTier
            ? input.requiredTierIds
            : await paidTierIds();
        const result = await verifyPatreonEntitlement(accessToken, allowedIds);
        if (result.tierIds.length) {
          await replaceManualGrants(input.user.id);
          return {
            entitled: result.entitled,
            tierIds: result.tierIds,
            source: "patreon",
            verifiedAt,
            expiresAt: null,
            denialReason: result.entitled ? undefined : "no_qualifying_tier",
          };
        }
      } catch {
        liveUnavailable = true;
      }
    }
  }

  const grant = await activeManualGrant(input.user.id);
  if (grant) {
    const qualifies = input.requiredTierIds.length
      ? grant.tierIds.some((id) => input.requiredTierIds.includes(id))
      : input.allowAnyPaidTier
        ? grant.tierIds.some((id) => grant.paidTierIds.includes(id))
        : false;
    return {
      entitled: qualifies,
      tierIds: grant.tierIds,
      source: "complimentary",
      verifiedAt,
      expiresAt: grant.expiresAt,
      denialReason: qualifies ? undefined : "no_qualifying_tier",
    };
  }

  return {
    entitled: false,
    tierIds: [],
    source: "none",
    verifiedAt,
    expiresAt: null,
    denialReason: liveUnavailable
      ? "verification_unavailable"
      : "no_qualifying_tier",
  };
}

async function activeManualGrant(userId: string) {
  if (!isDatabaseConfigured()) return null;
  const now = new Date().toISOString();
  const rows = await getDb()
    .select({
      id: manualGrants.id,
      expiresAt: manualGrants.expiresAt,
      tierId: manualGrantTiers.tierId,
      amountCents: patreonTiers.amountCents,
    })
    .from(manualGrants)
    .innerJoin(
      manualGrantTiers,
      eq(manualGrantTiers.grantId, manualGrants.id),
    )
    .innerJoin(patreonTiers, eq(patreonTiers.id, manualGrantTiers.tierId))
    .where(
      and(
        eq(manualGrants.userId, userId),
        eq(manualGrants.status, "active"),
        or(isNull(manualGrants.expiresAt), gt(manualGrants.expiresAt, now)),
      ),
    );
  if (!rows.length) return null;
  return {
    expiresAt: rows[0].expiresAt,
    tierIds: rows.map((row) => row.tierId),
    paidTierIds: rows
      .filter((row) => row.amountCents > 0)
      .map((row) => row.tierId),
  };
}

async function paidTierIds() {
  if (!isDatabaseConfigured()) return [];
  const rows = await getDb()
    .select({ id: patreonTiers.id })
    .from(patreonTiers)
    .where(and(eq(patreonTiers.isPublished, true), gt(patreonTiers.amountCents, 0)));
  return rows.map((row) => row.id);
}

export async function replaceManualGrants(userId: string) {
  if (!isDatabaseConfigured()) return;
  const now = new Date().toISOString();
  await getDb()
    .update(manualGrants)
    .set({
      status: "replaced",
      revokedAt: now,
      revocationReason: "replaced_by_patreon",
      updatedAt: now,
    })
    .where(
      and(
        eq(manualGrants.userId, userId),
        eq(manualGrants.status, "active"),
      ),
    );
}
