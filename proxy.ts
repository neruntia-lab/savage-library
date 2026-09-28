import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ASSET = /\.(?:avif|gif|ico|jpe?g|png|svg|txt|webmanifest|webp|xml)$/i;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname === "/maintenance" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/_vercel") ||
    PUBLIC_ASSET.test(pathname)
  ) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL("/maintenance", request.url));
}

export const config = {
  matcher: "/:path*",
};
