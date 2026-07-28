import type { NextAuthOptions } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { OAuthConfig } from "next-auth/providers/oauth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import { getDb, isDatabaseConfigured } from "./db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "./db/schema";
import { verifyScryptPassword } from "./lib/services/password";

type PatreonIdentity = {
  data: {
    id: string;
    attributes?: {
      full_name?: string;
      image_url?: string;
    };
  };
};

const patreonProvider: OAuthConfig<PatreonIdentity> = {
  id: "patreon",
  name: "Patreon",
  type: "oauth",
  version: "2.0",
  authorization: {
    url: "https://www.patreon.com/oauth2/authorize",
    params: {
      scope: "identity identity.memberships",
    },
  },
  token: "https://www.patreon.com/api/oauth2/token",
  userinfo: {
    url:
      "https://www.patreon.com/api/oauth2/v2/identity" +
      "?fields%5Buser%5D=full_name,image_url",
  },
  profile(profile) {
    return {
      id: profile.data.id,
      name: profile.data.attributes?.full_name ?? "Patreon member",
      email: null,
      image: profile.data.attributes?.image_url ?? null,
      role: "patron",
      provider: "patreon",
    };
  },
  clientId: process.env.PATREON_CLIENT_ID,
  clientSecret: process.env.PATREON_CLIENT_SECRET,
};

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    id: "admin-password",
    name: "Admin password",
    credentials: {
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const password = credentials?.password ?? "";
      const hash = process.env.ADMIN_PASSWORD_HASH ?? "";
      if (!password || !hash || !verifyScryptPassword(password, hash)) {
        return null;
      }

      return {
        id: "shared-admin",
        name: "Savage Library administrator",
        email: "admin@savage-library.local",
        role: "admin",
        provider: "admin-password",
      };
    },
  }),
  patreonProvider,
];

if (
  process.env.EMAIL_SERVER &&
  process.env.EMAIL_FROM &&
  isDatabaseConfigured()
) {
  providers.push(
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      maxAge: 15 * 60,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: isDatabaseConfigured()
    ? DrizzleAdapter(getDb(), {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      })
    : undefined,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/admin/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "patron";
        token.provider = user.provider ?? account?.provider ?? "patreon";
      }
      if (account?.provider === "patreon") {
        token.patreonAccessToken = account.access_token;
        token.patreonRefreshToken = account.refresh_token;
        token.patreonExpiresAt = account.expires_at;
      }
      if (
        token.provider === "patreon" &&
        typeof token.patreonExpiresAt === "number" &&
        token.patreonExpiresAt * 1_000 <= Date.now() + 60_000 &&
        typeof token.patreonRefreshToken === "string"
      ) {
        const refreshed = await refreshPatreonCredentials(
          token.patreonRefreshToken,
        );
        if (refreshed) {
          token.patreonAccessToken = refreshed.accessToken;
          token.patreonRefreshToken =
            refreshed.refreshToken ?? token.patreonRefreshToken;
          token.patreonExpiresAt = refreshed.expiresAt;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? "");
        session.user.role = token.role === "admin" ? "admin" : "patron";
        session.user.provider = String(token.provider ?? "");
      }
      return session;
    },
  },
};

async function refreshPatreonCredentials(refreshToken: string) {
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
  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) return null;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + (body.expires_in ?? 2_592_000),
  };
}
