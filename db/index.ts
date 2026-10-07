import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { isLocalPreview } from "../lib/config/local-preview";

let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function isDatabaseConfigured(): boolean {
  return !isLocalPreview() && Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (isLocalPreview()) throw new Error("Local design preview is read-only. Connect a separate development database to save changes.");
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Public catalog reads use bundled examples until Neon is connected.",
    );
  }

  database ??= drizzle(neon(url), { schema });
  return database;
}
