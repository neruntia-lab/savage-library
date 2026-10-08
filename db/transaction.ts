import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { isLocalPreview } from "../lib/config/local-preview";

export type WriteDatabase = Pick<
  PgDatabase<PgQueryResultHKT, typeof schema>,
  "select" | "insert" | "update" | "delete"
>;

// Interactive workflows need one connection; HTTP reads retain their existing driver.
export async function withWriteTransaction<T>(
  work: (db: WriteDatabase) => Promise<T>,
): Promise<T> {
  if (isLocalPreview() || !process.env.DATABASE_URL)
    throw new Error("A separate writable database is required.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    return await drizzle(pool, { schema }).transaction(async (tx) => {
      await tx.execute("SET LOCAL lock_timeout = '10s'");
      return work(tx);
    });
  } finally {
    await pool.end();
  }
}
