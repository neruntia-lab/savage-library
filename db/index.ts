import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Public catalog reads use bundled examples until Neon is connected.",
    );
  }

  database ??= drizzle(neon(url), { schema });
  return database;
}
