import { getChatGPTUser, type ChatGPTUser } from "../../app/chatgpt-auth";
import { isAdminEmail } from "../config/permissions";

export type AuthorizedUser = ChatGPTUser & {
  id: string;
  isAdmin: boolean;
};

export async function getAuthorizedUser(): Promise<AuthorizedUser | null> {
  const user = await getChatGPTUser();
  if (!user) return null;

  return {
    ...user,
    id: await stableUserId(user.email),
    isAdmin: isAdminEmail(user.email),
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
        { error: "Sign in to continue." },
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

async function stableUserId(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return `user-${Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}
