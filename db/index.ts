import { drizzle } from "drizzle-orm/d1";
import { getDatabaseBinding } from "../lib/platform/bindings";
import * as schema from "./schema";

export function getDb() {
  const database = getDatabaseBinding();
  if (!database) {
    throw new Error(
      "A database binding is unavailable. Public catalog reads will use bundled seed data until persistent storage is configured."
    );
  }

  return drizzle(database, { schema });
}
