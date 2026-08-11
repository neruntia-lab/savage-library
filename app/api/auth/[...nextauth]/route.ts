import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "../../../../auth";
import {
  enforceRateLimit,
  requestIdentifier,
} from "../../../../lib/services/rate-limit";

const handler = NextAuth(authOptions);

export { handler as GET };

export async function POST(request: NextRequest) {
  if (request.nextUrl.pathname.endsWith("/callback/admin-password")) {
    const limit = await enforceRateLimit({
      scope: "admin",
      identifier: requestIdentifier(request),
      limit: 8,
      windowSeconds: 15 * 60,
    });
    if (!limit.allowed) return limit.response;
  }
  return handler(request);
}
