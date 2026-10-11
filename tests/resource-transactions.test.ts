import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../db/schema";
import {
  createResource,
  updateResource,
} from "../lib/repositories/resource-write-repository";
import { persistUploadedBlob } from "../lib/repositories/file-repository";
import type { ResourceInput } from "../lib/validation/resource";
import { listCatalogFromDatabase } from "../lib/repositories/resource-repository";
import { synchronizationClaim } from "../db/synchronization-lock";

test("multi-table resource and artwork writes roll back together", async () => {
  const pg = new PGlite();
  try {
    const migrations = new URL("../drizzle/", import.meta.url);
    for (const file of readdirSync(migrations)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      await pg.exec(readFileSync(new URL(file, migrations), "utf8"));
    }
    const db = drizzle(pg, { schema });
    assert.equal(
      (await db.execute(synchronizationClaim("first-owner"))).rows.length,
      1,
    );
    assert.equal(
      (await db.execute(synchronizationClaim("second-owner"))).rows.length,
      0,
    );
    await pg.exec(
      "UPDATE sync_states SET updated_at = (CURRENT_TIMESTAMP - INTERVAL '6 minutes')::text WHERE id='patreon-sync-lease'",
    );
    assert.equal(
      (await db.execute(synchronizationClaim("second-owner"))).rows.length,
      1,
    );
    assert.equal(
      (await db.select().from(schema.syncStates))[0].status,
      "second-owner",
    );
    await pg.exec(`INSERT INTO authors(id,name,slug) VALUES('author','Author','author');
      INSERT INTO categories(id,name,slug) VALUES('category','Modules','modules');
      INSERT INTO game_systems(id,name,slug) VALUES('system','System','system');`);
    const translation = {
      title: "Module",
      shortDescription: "Summary",
      description: "Description",
      isPublished: false,
    };
    const input: ResourceInput = {
      title: "Module",
      slug: "module",
      shortDescription: "Summary",
      description: "Description",
      resourceType: "module",
      categoryId: "category",
      authorId: "author",
      gameSystemId: "system",
      currentVersion: "1.0.0",
      compatibilityStatus: "untested",
      pricing: "free",
      defaultLocale: "en",
      accessMode: "public",
      tagIds: [],
      dependencies: [],
      patreonTierIds: [],
      translations: { en: translation, es: { ...translation, title: "" } },
      isPublished: false,
      isFeatured: false,
      useIconEverywhere: false,
    };
    await assert.rejects(
      db.transaction((tx) =>
        createResource({ ...input, tagIds: ["missing-tag"] }, tx),
      ),
    );
    assert.equal((await db.select().from(schema.resources)).length, 0);
    assert.equal((await db.select().from(schema.resourceVersions)).length, 0);
    assert.equal((await db.select().from(schema.wikiGuides)).length, 0);
    const id = await db.transaction((tx) => createResource(input, tx));
    await assert.rejects(
      db.transaction((tx) =>
        updateResource(
          id,
          {
            ...input,
            title: "Broken save",
            currentVersion: "2.0.0",
            tagIds: ["missing"],
          },
          tx,
        ),
      ),
    );
    assert.equal((await db.select().from(schema.resources))[0].title, "Module");
    assert.equal((await db.select().from(schema.resourceVersions)).length, 1);
    assert.equal(
      (await db.select().from(schema.resourceTranslations))[0].title,
      "Module",
    );
    const version = (await db.select().from(schema.resourceVersions))[0];
    const artwork = {
      resourceVersionId: version.id,
      kind: "icon" as const,
      locale: "en" as const,
      originalName: "icon.png",
      extension: "png",
      mimeType: "image/png",
      sizeBytes: 123,
      uploadedBy: "admin",
      blob: {
        url: "https://example.public.blob.vercel-storage.com/icon.png",
        pathname: "icon.png",
      },
    };
    await assert.rejects(
      db.transaction(async (tx) => {
        await persistUploadedBlob(artwork, tx);
        throw new Error("Persistence failed before commit");
      }),
    );
    assert.equal((await db.select().from(schema.files)).length, 0);
    assert.equal((await db.select().from(schema.resources))[0].iconKey, null);
    await db.transaction((tx) => persistUploadedBlob(artwork, tx));
    await db.transaction((tx) => persistUploadedBlob(artwork, tx));
    assert.equal((await db.select().from(schema.files)).length, 1);
    assert.equal(
      (await db.select().from(schema.resources))[0].iconKey,
      artwork.blob.url,
    );
    // Real PostgreSQL queries over a 10,000-entry fixture; no hosted credentials.
    await pg.exec(`INSERT INTO resources(id,slug,title,short_description,description,resource_type,category_id,author_id,game_system_id,current_version,compatibility_status,is_published,published_at)
      SELECT 'r' || lpad(i::text,5,'0'), 'resource-' || i, 'Module ' || i, 'Summary', 'Private long description', 'pdf', 'category', 'author', 'system', '1.0.0', 'untested', true, '2026-10-08T00:00:00.000Z'
      FROM generate_series(1,10000) AS i;
      UPDATE resources SET publisher_token_hash='secret-hash', manifest_url='https://example.com/private', access_mode='patreon' WHERE id='r00001';`);
    const filters = { sort: "recently-added" as const, page: 1, pageSize: 24 };
    const first = await listCatalogFromDatabase(filters, {}, db);
    assert.equal(first.total, 10000);
    assert.equal(first.items.length, 24);
    assert.equal(first.items[0].id, "r00001");
    assert.doesNotMatch(
      JSON.stringify(first),
      /secret-hash|example.com\/private|Private long description/,
    );
    const second = await listCatalogFromDatabase(
      { ...filters, page: 2 },
      {},
      db,
    );
    assert.equal(second.items[0].id, "r00025");
    const last = await listCatalogFromDatabase(
      { ...filters, page: 9999 },
      {},
      db,
    );
    assert.equal(last.page, 417);
    assert.equal(last.items.length, 16);
    assert.equal(
      (await listCatalogFromDatabase({ ...filters, query: "MODULE" }, {}, db))
        .total,
      10000,
    );
    assert.equal(
      (await listCatalogFromDatabase({ ...filters, query: "%" }, {}, db)).total,
      0,
    );
    await pg.exec(
      "UPDATE resources SET foundry_minimum='14.100', foundry_maximum='14.999' WHERE id='r00001'",
    );
    assert.equal(
      (
        await listCatalogFromDatabase(
          { ...filters, query: "Module 1", foundryVersion: "14" },
          {},
          db,
        )
      ).items.some((r) => r.id === "r00001"),
      true,
    );
    assert.equal(
      (
        await listCatalogFromDatabase(
          { ...filters, query: "Module 1", foundryVersion: "13" },
          {},
          db,
        )
      ).items.some((r) => r.id === "r00001"),
      false,
    );
  } finally {
    await pg.close();
  }
});
