/** Member connections are paused unless explicitly enabled on the server. */
export function patreonMemberConnectionsEnabled(): boolean {
  return process.env.PATREON_MEMBER_CONNECTIONS_ENABLED === "true";
}
