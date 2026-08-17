import type { AdminCliScope } from "../repositories/admin-cli-token-repository";
import { authenticateAdminCliToken } from "../repositories/admin-cli-token-repository";

export async function requireAdminCliToken(
  request: Request,
  scopes: AdminCliScope[] = [],
) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const credential = bearer ? await authenticateAdminCliToken(bearer) : null;
  if (!credential) {
    return {
      ok: false as const,
      response: Response.json(
        {
          ok: false,
          code: "admin_cli_token_invalid",
          error: "A valid administrator CLI token with the required scopes is required.",
        },
        { status: 401 },
      ),
    };
  }
  const missingScopes = scopes.filter((scope) => !credential.scopes.includes(scope));
  if (missingScopes.length) {
    return {
      ok: false as const,
      response: Response.json(
        {
          ok: false,
          code: "admin_cli_scope_missing",
          error: `The administrator CLI token is missing: ${missingScopes.join(", ")}.`,
        },
        { status: 403 },
      ),
    };
  }
  return { ok: true as const, credential };
}
