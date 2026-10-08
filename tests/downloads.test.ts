import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { downloadEventQuery } from "../lib/repositories/download-queries";
import {
  DownloadDeliveryError,
  prepareTrackedDownload,
  downloadErrorResponse,
} from "../lib/services/download-delivery";
import {
  databaseFingerprint,
  resetDownloadCounters,
  inspectDownloadCounters,
} from "../scripts/download-counter-reset.mjs";
import { SEED_RESOURCES } from "../lib/data/seed-resources";

test("sample and newly seeded counters start at zero", () => {
  assert.ok(
    SEED_RESOURCES.every(
      (r) => r.downloadCount === 0 && r.popularityScore === 0,
    ),
  );
  const seed = readFileSync(
    new URL("../lib/repositories/resource-seed.ts", import.meta.url),
    "utf8",
  );
  assert.match(seed, /downloadCount: 0/);
  assert.match(seed, /popularityScore: 0/);
});

test("database fingerprints identify pooled/unpooled targets without exposing passwords", () => {
  const a = databaseFingerprint(
    "postgresql://admin:secret@ep-test-pooler.us.neon.tech/db",
  );
  assert.equal(
    a,
    databaseFingerprint(
      "postgresql://other:newpassword@ep-test.us.neon.tech/db",
    ),
  );
  assert.notEqual(
    a,
    databaseFingerprint("postgresql://admin:secret@ep-other.us.neon.tech/db"),
  );
  assert.notEqual(
    a,
    databaseFingerprint(
      "postgresql://admin:secret@ep-test.us.neon.tech/another",
    ),
  );
  assert.match(a, /^[a-f0-9]{20}$/);
});

test("delivery counts only after signed-URL generation and returns controlled errors", async () => {
  const order: string[] = [];
  const dependencies = {
    createUrl: async () => {
      order.push("url");
      return "https://store.private.blob.vercel-storage.com/file?token=secret";
    },
    record: async () => {
      order.push("event");
    },
  };
  assert.equal(
    await prepareTrackedDownload(dependencies),
    "https://store.private.blob.vercel-storage.com/file?token=secret",
  );
  assert.deepEqual(order, ["url", "event"]);
  order.length = 0;
  await assert.rejects(
    prepareTrackedDownload({
      ...dependencies,
      createUrl: async () => {
        throw new Error("secret storage token");
      },
    }),
    (error) =>
      error instanceof DownloadDeliveryError && error.stage === "storage",
  );
  assert.deepEqual(order, []);
  const response = downloadErrorResponse(new DownloadDeliveryError("tracking"));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.doesNotMatch(await response.text(), /secret/);
  await assert.rejects(
    prepareTrackedDownload({
      ...dependencies,
      record: async () => {
        throw new Error("private database password");
      },
    }),
    (error) =>
      error instanceof DownloadDeliveryError && error.stage === "tracking",
  );
  assert.equal(
    downloadErrorResponse(new Error("secret connection string")).status,
    502,
  );
});

test("HEAD requests and malformed download URLs never increment counters", async () => {
  let recorded = 0;
  const record = async () => {
    recorded++;
  };
  await prepareTrackedDownload({
    createUrl: async () => "https://example.org/file",
    record,
    track: false,
  });
  assert.equal(recorded, 0);
  for (const url of ["bad", "http://example.org/file", "javascript:alert(1)"])
    await assert.rejects(
      prepareTrackedDownload({ createUrl: async () => url, record }),
      DownloadDeliveryError,
    );
  assert.equal(recorded, 0);
});

test("PostgreSQL reset and download tracking are atomic and preserve history", async (t) => {
  const db = new PGlite();
  const dialect = new PgDialect();
  const record = async (fileId = "file", resourceId = "r1") => {
    const query = dialect.sqlToQuery(
      downloadEventQuery({ resourceId, fileId, visitorHash: "visitor" }),
    );
    return db.query(query.sql, query.params);
  };
  const fingerprint = "test-fingerprint";
  const options = {
    client: db,
    environment: "development",
    fingerprint,
    confirmation: fingerprint,
  };
  try {
    await db.exec(`CREATE TABLE resources (id text PRIMARY KEY, title text, is_published boolean,
      download_count integer NOT NULL DEFAULT 0, popularity_score integer NOT NULL DEFAULT 0);
      CREATE TABLE files (id text PRIMARY KEY);
      CREATE TABLE downloads (id text PRIMARY KEY, resource_id text REFERENCES resources(id), file_id text REFERENCES files(id),
        visitor_hash text, downloaded_at text DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE protected_post_links (id text PRIMARY KEY, access_count integer NOT NULL DEFAULT 0, destination text);
      CREATE TABLE sync_states (id text PRIMARY KEY, status text, last_started_at text, last_succeeded_at text);
      CREATE TABLE memberships (id text PRIMARY KEY, active boolean);
      INSERT INTO resources VALUES ('r1', 'First', true, 12, 7), ('r2', 'Second', false, 5, 3);
      INSERT INTO files VALUES ('file');
      INSERT INTO downloads VALUES ('historic', 'r1', 'file', 'old', '2025-01-01');
      INSERT INTO protected_post_links VALUES ('link', 4, 'https://example.org/private');
      INSERT INTO memberships VALUES ('patron', true);`);
    const before = await inspectDownloadCounters(db);
    const preserved = async () =>
      (await db.query("SELECT * FROM downloads WHERE id='historic'")).rows;
    const historic = await preserved();
    await t.test(
      "dry runs and confirmation failures cannot write",
      async () => {
        assert.deepEqual(await inspectDownloadCounters(db), before);
        await assert.rejects(
          resetDownloadCounters({
            ...options,
            confirmation: "wrong",
            saveBackup: async () => {},
          }),
          /Confirm/,
        );
        assert.deepEqual(await inspectDownloadCounters(db), before);
      },
    );
    await t.test(
      "backup failure leaves counters and completion marker untouched",
      async () => {
        await assert.rejects(
          resetDownloadCounters({
            ...options,
            saveBackup: async () => {
              throw new Error("Disk full");
            },
          }),
          /Disk full/,
        );
        assert.deepEqual(await inspectDownloadCounters(db), before);
      },
    );
    await t.test(
      "failed reset rolls back every counter and marker",
      async () => {
        await db.exec(`CREATE FUNCTION reject_reset() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Test reset failure'; END; $$;
        CREATE TRIGGER reject_reset BEFORE UPDATE ON protected_post_links FOR EACH ROW EXECUTE FUNCTION reject_reset();`);
        await assert.rejects(
          resetDownloadCounters({ ...options, saveBackup: async () => {} }),
          /Test reset failure/,
        );
        assert.deepEqual(await inspectDownloadCounters(db), before);
        await db.exec("DROP TRIGGER reject_reset ON protected_post_links");
      },
    );
    await t.test(
      "successful reset backs up exact values and preserves unrelated data",
      async () => {
        let backedUp = false;
        const result = await resetDownloadCounters({
          ...options,
          saveBackup: async (snapshot: {
            resources: unknown;
            links: unknown;
          }) => {
            assert.deepEqual(snapshot.resources, before.resources);
            assert.deepEqual(snapshot.links, before.links);
            backedUp = true;
          },
        });
        assert.equal(backedUp, true);
        assert.equal(result.status, "reset");
        assert.deepEqual(result.totals, {
          resources: 2,
          links: 1,
          downloads: 0,
          popularity: 0,
          protectedLinkAccesses: 0,
        });
        assert.deepEqual(await preserved(), historic);
        assert.deepEqual(
          (
            await db.query(
              "SELECT title, is_published FROM resources ORDER BY id",
            )
          ).rows,
          [
            { title: "First", is_published: true },
            { title: "Second", is_published: false },
          ],
        );
        assert.equal((await db.query("SELECT * FROM files")).rows.length, 1);
        assert.deepEqual((await db.query("SELECT * FROM memberships")).rows, [
          { id: "patron", active: true },
        ]);
        assert.equal(
          (
            await db.query<{ destination: string }>(
              "SELECT destination FROM protected_post_links",
            )
          ).rows[0].destination,
          "https://example.org/private",
        );
      },
    );
    await t.test(
      "repeat and parallel requests each increment atomically",
      async () => {
        await Promise.all(Array.from({ length: 20 }, () => record()));
        assert.deepEqual(
          (
            await db.query(
              "SELECT download_count, popularity_score FROM resources WHERE id='r1'",
            )
          ).rows[0],
          { download_count: 20, popularity_score: 20 },
        );
        assert.equal(
          (await db.query("SELECT * FROM downloads")).rows.length,
          21,
        );
      },
    );
    await t.test(
      "repeating a completed reset cannot erase new downloads",
      async () => {
        const result = await resetDownloadCounters({
          ...options,
          saveBackup: async () => {
            assert.fail("Must not back up or reset again");
          },
        });
        assert.equal(result.status, "already_completed");
        assert.equal(result.totals.downloads, 20);
      },
    );
    await t.test(
      "missing resources and invalid files create no events or increments",
      async () => {
        assert.equal((await record("file", "missing")).rows.length, 0);
        await assert.rejects(record("missing-file"), /foreign key/);
        assert.equal(
          (
            await db.query<{ download_count: number }>(
              "SELECT download_count FROM resources WHERE id='r1'",
            )
          ).rows[0].download_count,
          20,
        );
        assert.equal(
          (await db.query("SELECT * FROM downloads")).rows.length,
          21,
        );
      },
    );
    await t.test("counter failures roll back the audit event", async () => {
      await db.exec(`CREATE FUNCTION reject_increment() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Test increment failure'; END; $$;
        CREATE TRIGGER reject_increment BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION reject_increment();`);
      await assert.rejects(record(), /Test increment failure/);
      assert.equal((await db.query("SELECT * FROM downloads")).rows.length, 21);
      assert.equal(
        (
          await db.query<{ download_count: number }>(
            "SELECT download_count FROM resources WHERE id='r1'",
          )
        ).rows[0].download_count,
        20,
      );
    });
  } finally {
    await db.close();
  }
});
