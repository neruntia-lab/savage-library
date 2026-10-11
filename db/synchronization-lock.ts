import { sql } from "drizzle-orm";
import { getDb } from ".";
import { isLocalPreview } from "../lib/config/local-preview";

export class SynchronizationBusyError extends Error {
  constructor() {
    super(
      "Patreon synchronization is already running. Please retry after it finishes.",
    );
  }
}

// A row lease works with transaction-pooled Neon URLs; session advisory locks do not.
export function synchronizationClaim(owner: string) {
  return sql`INSERT INTO sync_states (id, status, last_started_at, updated_at)
    VALUES ('patreon-sync-lease', ${owner}, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text)
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status,
      last_started_at = EXCLUDED.last_started_at, updated_at = EXCLUDED.updated_at
    WHERE sync_states.status = 'released'
      OR sync_states.updated_at::timestamptz < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
    RETURNING id`;
}

export async function withSynchronizationLock<T>(
  work: (assertOwned: () => void) => Promise<T>,
): Promise<T> {
  if (isLocalPreview() || !process.env.DATABASE_URL)
    throw new Error("A writable database is required for synchronization.");
  const db = getDb();
  const owner = crypto.randomUUID();
  const claim = await db.execute(synchronizationClaim(owner));
  if (!claim.rows.length) throw new SynchronizationBusyError();
  let lost = false;
  let lastConfirmedAt = Date.now();
  let heartbeat: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (heartbeat) return;
    heartbeat = db
      .execute(
        sql`UPDATE sync_states SET updated_at = CURRENT_TIMESTAMP::text
      WHERE id = 'patreon-sync-lease' AND status = ${owner} RETURNING id`,
      )
      .then((result) => {
        if (!result.rows.length) lost = true;
        else lastConfirmedAt = Date.now();
      })
      .catch(() => {
        lost = true;
      })
      .finally(() => {
        heartbeat = undefined;
      });
  }, 30000);
  const assertOwned = () => {
    if (lost || Date.now() - lastConfirmedAt > 240000)
      throw new Error("Synchronization ownership was lost. Please retry.");
  };
  try {
    return await work(assertOwned);
  } finally {
    clearInterval(timer);
    await heartbeat;
    await db
      .execute(
        sql`UPDATE sync_states SET status = 'released', updated_at = CURRENT_TIMESTAMP::text
      WHERE id = 'patreon-sync-lease' AND status = ${owner}`,
      )
      .catch(() => undefined);
  }
}
