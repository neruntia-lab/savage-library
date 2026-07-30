import { NextRequest, NextResponse } from "next/server";
import {
  getProtectedPostLink,
  recordProtectedLinkAccess,
} from "../../../../../lib/repositories/post-repository";
import { getAuthorizedUser } from "../../../../../lib/services/auth";
import { resolveEntitlement } from "../../../../../lib/services/entitlements";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const record = await getProtectedPostLink(id);
  if (!record || record.postPublished !== "approved") {
    return Response.json({ error: "Download not found." }, { status: 404 });
  }
  const user = await getAuthorizedUser();
  if (!user) {
    const signIn = new URL("/api/auth/signin", request.url);
    signIn.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signIn);
  }
  const requiredTierIds = safeIds(record.link.requiredTierIds);
  const entitlement = await resolveEntitlement({
    user,
    request,
    requiredTierIds,
    allowAnyPaidTier: requiredTierIds.length === 0,
  });
  if (!entitlement.entitled) {
    return NextResponse.redirect(new URL("/account?access=required", request.url));
  }
  await recordProtectedLinkAccess(id);
  return NextResponse.redirect(record.link.destination, 302);
}

function safeIds(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
