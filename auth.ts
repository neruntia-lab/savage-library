import type { NextAuthOptions } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";
import CredentialsProvider from "next-auth/providers/credentials";
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
      email: `${profile.data.id}@patreon.invalid`,
      image: profile.data.attributes?.image_url ?? null,
      role: "patron",
      provider: "patreon",
    };
  },
  clientId: process.env.PATREON_CLIENT_ID,
  clientSecret: process.env.PATREON_CLIENT_SECRET,
};

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
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
  ],
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
