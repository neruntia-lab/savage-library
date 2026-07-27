import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { authOptions } from "../../auth";

export type AuthorizedUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  provider: string;
};

export async function getAuthorizedUser(): Promise<AuthorizedUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id) return null;

  const displayName = user.name ?? (user.role === "admin" ? "Administrator" : "Patreon member");
  return {
    id: user.id,
    displayName,
    email: user.email ?? `${user.id}@patreon.invalid`,
    fullName: user.name ?? null,
    isAdmin: user.role === "admin",
    provider: user.provider,
  };
}

export async function requireApiUser(): Promise<
  | { ok: true; user: AuthorizedUser }
  | { ok: false; response: Response }
> {
  const user = await getAuthorizedUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        { error: "Sign in with Patreon to continue." },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user };
}

export async function requireApiAdmin(): Promise<
  | { ok: true; user: AuthorizedUser }
  | { ok: false; response: Response }
> {
  const result = await requireApiUser();
  if (!result.ok) return result;
  if (!result.user.isAdmin) {
    return {
      ok: false,
      response: Response.json(
        { error: "Administrator access is required." },
        { status: 403 },
      ),
    };
  }
  return result;
}

export async function requireAdminPage(): Promise<AuthorizedUser | null> {
  const user = await getAuthorizedUser();
  return user?.isAdmin ? user : null;
}

export async function getPatreonAccessToken(
  request: NextRequest,
): Promise<string | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const token = await getToken({ req: request, secret });
  if (
    token?.provider !== "patreon" ||
    typeof token.patreonAccessToken !== "string"
  ) {
    return null;
  }

  const expiresAt =
    typeof token.patreonExpiresAt === "number"
      ? token.patreonExpiresAt * 1_000
      : Number.POSITIVE_INFINITY;
  if (expiresAt > Date.now() + 60_000) return token.patreonAccessToken;

  if (typeof token.patreonRefreshToken !== "string") return null;
  return refreshPatreonAccessToken(token.patreonRefreshToken);
}

async function refreshPatreonAccessToken(
  refreshToken: string,
): Promise<string | null> {
  const clientId = process.env.PATREON_CLIENT_ID;
  const clientSecret = process.env.PATREON_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const response = await fetch("https://www.patreon.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;

  const body = (await response.json()) as { access_token?: unknown };
  return typeof body.access_token === "string" ? body.access_token : null;
}
