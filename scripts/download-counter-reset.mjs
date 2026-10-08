import { createHash } from "node:crypto";

export const RESET_OPERATION = "download-counter-reset-v1";

export function databaseFingerprint(connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("Expected a PostgreSQL connection.");
  // Pooled and unpooled URLs for one Neon branch identify the same database.
  const host = url.hostname.replace(/-pooler(?=\.)/, "");
  return createHash("sha256")
    .update(`${host}:${url.port || "5432"}${url.pathname}`)
    .digest("hex")
    .slice(0, 20);
}

export async function inspectDownloadCounters(client) {
  const resources = (
    await client.query(
      "SELECT id, download_count, popularity_score FROM resources ORDER BY id",
    )
  ).rows;
  const links = (
    await client.query(
      "SELECT id, access_count FROM protected_post_links ORDER BY id",
    )
  ).rows;
  const marker = (
    await client.query(
      "SELECT status, last_succeeded_at FROM sync_states WHERE id=$1",
      [RESET_OPERATION],
    )
  ).rows[0];
  return { resources, links, marker: marker ?? null };
}

export function counterTotals(snapshot) {
  return {
    resources: snapshot.resources.length,
    links: snapshot.links.length,
    downloads: snapshot.resources.reduce(
      (sum, row) => sum + row.download_count,
      0,
    ),
    popularity: snapshot.resources.reduce(
      (sum, row) => sum + row.popularity_score,
      0,
    ),
    protectedLinkAccesses: snapshot.links.reduce(
      (sum, row) => sum + row.access_count,
      0,
    ),
  };
}

export async function resetDownloadCounters({
  client,
  environment,
  fingerprint,
  confirmation,
  saveBackup,
}) {
  if (
    !["production", "development"].includes(environment) ||
    !fingerprint ||
    confirmation !== fingerprint
  )
    throw new Error(
      "Confirm the exact database fingerprint and environment before resetting.",
    );
  if (typeof saveBackup !== "function")
    throw new Error("A verified backup is required.");
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout = '10s'");
    // Exclude concurrent resets/writes while capturing exactly the values reset.
    await client.query(
      "LOCK TABLE resources, protected_post_links, sync_states IN SHARE ROW EXCLUSIVE MODE",
    );
    const snapshot = await inspectDownloadCounters(client);
    if (snapshot.marker) {
      if (snapshot.marker.status !== "complete")
        throw new Error(
          "An unexpected reset marker requires administrator review.",
        );
      await client.query("COMMIT");
      return { status: "already_completed", totals: counterTotals(snapshot) };
    }
    const capturedAt = new Date().toISOString();
    await saveBackup({
      formatVersion: 1,
      operation: RESET_OPERATION,
      environment,
      fingerprint,
      capturedAt,
      resources: snapshot.resources,
      links: snapshot.links,
    });
    await client.query(
      "UPDATE resources SET download_count=0, popularity_score=0",
    );
    await client.query("UPDATE protected_post_links SET access_count=0");
    await client.query(
      "INSERT INTO sync_states (id, status, last_started_at, last_succeeded_at) VALUES ($1, 'complete', $2, $2)",
      [RESET_OPERATION, capturedAt],
    );
    const totals = counterTotals(await inspectDownloadCounters(client));
    if (totals.downloads || totals.popularity || totals.protectedLinkAccesses)
      throw new Error("Counter reset verification failed.");
    await client.query("COMMIT");
    return { status: "reset", previousTotals: counterTotals(snapshot), totals };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
