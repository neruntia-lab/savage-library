import { NextResponse } from "next/server";
import {
  createPreviewAccessToken,
  PREVIEW_ACCESS_COOKIE,
  PREVIEW_ACCESS_SECONDS,
} from "../../../lib/services/preview-access";
import { verifyScryptPassword } from "../../../lib/services/password";
import {
  enforceRateLimit,
  requestIdentifier,
} from "../../../lib/services/rate-limit";

export async function POST(request: Request) {
  const passwordHash = process.env.PREVIEW_PASSWORD_HASH;
  const accessSecret = process.env.PREVIEW_ACCESS_SECRET;
  if (!passwordHash || !accessSecret) {
    return NextResponse.json(
      { error: "Preview access is temporarily unavailable." },
      { status: 503 },
    );
  }

  const rateLimit = await enforceRateLimit({
    scope: "preview",
    identifier: requestIdentifier(request),
    limit: 10,
    windowSeconds: 15 * 60,
  });
  if (!rateLimit.allowed) return rateLimit.response;

  const body = (await request.json().catch(() => null)) as {
    password?: unknown;
  } | null;
  const password =
    typeof body?.password === "string" ? body.password.slice(0, 512) : "";
  if (!password || !verifyScryptPassword(password, passwordHash)) {
    return NextResponse.json(
      { error: "The preview password is incorrect." },
      { status: 401 },
    );
  }

  const access = createPreviewAccessToken(accessSecret);
  const response = NextResponse.json({ authorized: true });
  response.cookies.set({
    name: PREVIEW_ACCESS_COOKIE,
    value: access.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PREVIEW_ACCESS_SECONDS,
    expires: access.expiresAt,
  });
  return response;
}
