import { env } from "cloudflare:workers";
import initialMigration from "../drizzle/0000_perfect_dakota_north.sql?raw";

let bootstrapPromise: Promise<void> | undefined;

export function ensureDatabaseSchema(): Promise<void> {
  bootstrapPromise ??= initializeSchema().catch((error) => {
    bootstrapPromise = undefined;
    throw error;
  });
  return bootstrapPromise;
}

async function initializeSchema(): Promise<void> {
  const database = env.DB;
  const existing = await database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .bind("resources")
    .first();
  if (existing) return;

  const statements = initialMigration
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  try {
    await database.batch(
      statements.map((statement) => database.prepare(statement)),
    );
  } catch (error) {
    const raced = await database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .bind("resources")
      .first();
    if (!raced) throw error;
  }
}
