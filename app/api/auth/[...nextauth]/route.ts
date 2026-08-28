import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "../../../../auth";
import {
  enforceRateLimit,
  requestIdentifier,
} from "../../../../lib/services/rate-limit";

const handler = NextAuth(authOptions);

type AuthRouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

export { handler as GET };

export async function POST(request: NextRequest, context: AuthRouteContext) {
  if (request.nextUrl.pathname.endsWith("/callback/admin-password")) {
    const limit = await enforceRateLimit({
      scope: "admin",
      identifier: requestIdentifier(request),
      limit: 8,
      windowSeconds: 15 * 60,
    });
    if (!limit.allowed) {
      return Response.json(
        { url: "/admin/login?error=RateLimited" },
        {
          status: 429,
          headers: {
            "Retry-After": limit.response.headers.get("Retry-After") ?? "900",
          },
        },
      );
    }
  }
  return handler(request, context);
}
