import { Client } from "@neondatabase/serverless";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseEnv } from "node:util";
import path from "node:path";
import {
  databaseFingerprint,
  inspectDownloadCounters,
  counterTotals,
  resetDownloadCounters,
} from "./download-counter-reset.mjs";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Dry run: npm run counters:reset -- --environment production|development --env-file <private-env-file>\nApply: add --apply --confirm <fingerprint-from-dry-run>\nBackups: work/counter-backups/. Repeating a completed reset preserves new downloads.",
    );
    return;
  }
  const value = (flag) => {
    const index = args.indexOf(flag);
    return index < 0 ? undefined : args[index + 1];
  };
  const environment = value("--environment"),
    envFile = value("--env-file");
  if (!["production", "development"].includes(environment) || !envFile)
    throw new Error(
      "Usage: node scripts/reset-download-counters.mjs --environment production|development --env-file <private-env-file> [--apply --confirm <fingerprint>]",
    );
  const configuration = parseEnv(readFileSync(path.resolve(envFile), "utf8"));
  const connectionString =
    configuration.DATABASE_URL_UNPOOLED || configuration.DATABASE_URL;
  if (!connectionString)
    throw new Error(
      "The selected environment has no database connection configured.",
    );
  const fingerprint = databaseFingerprint(connectionString);
  console.log(
    JSON.stringify({
      environment,
      fingerprint,
      mode: args.includes("--apply") ? "apply" : "dry_run",
    }),
  );
  // Never fall back to process.env or .env.local: the selected file is authoritative.
  const client = new Client({ connectionString });
  try {
    await client.connect();
    if (!args.includes("--apply")) {
      const snapshot = await inspectDownloadCounters(client);
      console.log(
        JSON.stringify({
          totals: counterTotals(snapshot),
          resetPreviouslyCompleted: Boolean(snapshot.marker),
        }),
      );
      return;
    }
    const output = path.resolve("work/counter-backups");
    mkdirSync(output, { recursive: true });
    const result = await resetDownloadCounters({
      client,
      environment,
      fingerprint,
      confirmation: value("--confirm"),
      saveBackup: async (snapshot) => {
        const filename = path.join(
          output,
          `${environment}-${fingerprint}-${Date.now()}.json`,
        );
        const serialized = JSON.stringify(snapshot, null, 2);
        writeFileSync(filename, serialized, { flag: "wx", mode: 0o600 });
        if (readFileSync(filename, "utf8") !== serialized)
          throw new Error("Backup verification failed.");
        console.log(`Verified counter backup: ${filename}`);
      },
    });
    console.log(JSON.stringify(result));
  } finally {
    await client.end();
  }
}

main().catch(() => {
  // Driver errors may contain connection details. Never log raw credentials/errors.
  console.error(
    "Counter reset failed. Check the selected environment file, database access, confirmation fingerprint, and backup directory. No successful reset is reported.",
  );
  process.exitCode = 1;
});
