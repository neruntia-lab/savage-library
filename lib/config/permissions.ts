export const ROLES = {
  user: "user",
  admin: "admin",
} as const;

export function isAdminEmail(email: string): boolean {
  const configured = process.env.ADMIN_EMAILS ?? "";
  const allowlist = configured
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(email.trim().toLowerCase());
}
