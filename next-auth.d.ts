import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: "admin" | "patron";
    provider?: string;
    emailVerified?: Date | null;
  }

  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "admin" | "patron";
      provider: string;
      emailVerified?: Date | null;
    };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "admin" | "patron";
    provider?: string;
    patreonAccessToken?: string;
    patreonRefreshToken?: string;
    patreonExpiresAt?: number;
  }
}
