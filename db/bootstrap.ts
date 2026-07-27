import { isDatabaseConfigured } from ".";

export async function ensureDatabaseSchema(): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }
}
