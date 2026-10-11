import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import type { WikiContent } from "../lib/domain/wiki";
import { validateWikiInput } from "../lib/services/wiki";

test("preview deployments cannot migrate an unconfirmed database", () => {
  const check = (environment: string, confirmed: string) =>
    spawnSync(process.execPath, ["scripts/check-preview-migrations.mjs"], {
      env: {
        ...process.env,
        VERCEL_ENV: environment,
        SAVAGE_LIBRARY_PREVIEW_DATABASE_CONFIRMED: confirmed,
      },
      encoding: "utf8",
    });
  const denied = check("preview", "");
  assert.equal(denied.status, 1);
  assert.match(denied.stderr, /Preview migrations blocked/);
  assert.equal(check("preview", "1").status, 0);
  assert.equal(check("production", "").status, 0);
  assert.equal(check("", "").status, 0);
});

test("module Wiki migration and hooks preserve private, idempotent starter drafts", async (t) => {
  // Ephemeral PostgreSQL only: never reads DATABASE_URL or writes hosted data.
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE resources (
      id text PRIMARY KEY, slug text, title text NOT NULL,
      resource_type text NOT NULL, default_locale text NOT NULL DEFAULT 'en'
    );`);
    await db.exec(
      readFileSync(
        new URL("../drizzle/0011_wiki_guides.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(`INSERT INTO resources (id, title, resource_type) VALUES
      ('old', 'Existing module', 'module'), ('linked', 'Has a draft', 'module'),
      ('published-linked', 'Has published documentation', 'module'), ('pdf', 'PDF', 'pdf');
      INSERT INTO wiki_guides (id, slug, draft, module_id, published_module_id, updated_by)
      VALUES ('manual', 'manual', '{}', 'linked', NULL, 'admin'),
        ('published', 'published', '{}', NULL, 'published-linked', 'admin');`);
    await db.exec(
      readFileSync(
        new URL("../drizzle/0012_module_wiki_starters.sql", import.meta.url),
        "utf8",
      ),
    );
    const starters = () =>
      db.query<{
        module_id: string;
        draft: WikiContent;
        slug: string;
        published_content: unknown;
      }>(
        "SELECT * FROM wiki_guides WHERE starter_resource_id IS NOT NULL ORDER BY module_id",
      );

    await t.test(
      "backfills only uncovered modules with matching titles and empty private content",
      async () => {
        const { rows } = await starters();
        assert.equal(rows.length, 1);
        assert.equal(rows[0].module_id, "old");
        assert.equal(rows[0].draft.translations.en.title, "Existing module");
        assert.equal(rows[0].draft.translations.en.body, "");
        assert.equal(rows[0].draft.translations.es.title, "");
        assert.equal(rows[0].published_content, null);
        assert.throws(() =>
          validateWikiInput(
            { slug: rows[0].slug, moduleId: "old", content: rows[0].draft },
            true,
          ),
        );
      },
    );
    await t.test(
      "inserts and type conversions create one localized draft",
      async () => {
        await db.exec(`INSERT INTO resources VALUES ('new', 'new', 'Módulo nuevo', 'module', 'es');
        UPDATE resources SET resource_type='module' WHERE id='pdf';`);
        const { rows } = await db.query<{ draft: WikiContent }>(
          "SELECT draft FROM wiki_guides WHERE module_id='new'",
        );
        assert.equal(rows[0].draft.defaultLocale, "es");
        assert.equal(rows[0].draft.translations.es.title, "Módulo nuevo");
        assert.equal(rows[0].draft.translations.en.title, "");
        assert.equal((await starters()).rows.length, 3);
      },
    );
    await t.test(
      "retries, renames, type changes and manual unlinking never overwrite edited guides",
      async () => {
        await db.exec(`UPDATE wiki_guides SET module_id=NULL,
        draft=jsonb_set(draft, '{translations,en,title}', '"Admin title"') WHERE starter_resource_id='old';
        UPDATE resources SET title='Renamed', resource_type='pdf' WHERE id='old';
        UPDATE resources SET resource_type='module' WHERE id='old';`);
        await Promise.all(
          Array.from({ length: 6 }, () =>
            db.query("SELECT ensure_module_wiki_draft('old')"),
          ),
        );
        const { rows } = await db.query<{
          draft: WikiContent;
          module_id: string | null;
        }>("SELECT * FROM wiki_guides WHERE starter_resource_id='old'");
        assert.equal(rows.length, 1);
        assert.equal(rows[0].module_id, null);
        assert.equal(rows[0].draft.translations.en.title, "Admin title");
        await assert.rejects(
          db.exec(`INSERT INTO wiki_guides (id, slug, draft, starter_resource_id, updated_by)
        VALUES ('duplicate', 'duplicate', '{}', 'old', 'admin')`),
          /duplicate key/,
        );
      },
    );
    await t.test(
      "slug collisions do not prevent module creation or replace existing guides",
      async () => {
        await db.exec(`INSERT INTO wiki_guides (id, slug, draft, updated_by)
        VALUES ('collision', 'module-' || md5('colliding'), '{}', 'admin');
        INSERT INTO resources VALUES ('colliding', 'colliding', 'Collision module', 'module', 'en');`);
        const { rows } = await db.query<{ slug: string }>(
          "SELECT slug FROM wiki_guides WHERE module_id='colliding'",
        );
        assert.match(rows[0].slug, /-1$/);
      },
    );
    await t.test(
      "resource deletion preserves documentation history",
      async () => {
        await db.exec("DELETE FROM resources WHERE id='new'");
        const { rows } = await db.query<{
          module_id: null;
          starter_resource_id: null;
        }>(
          "SELECT * FROM wiki_guides WHERE draft->'translations'->'es'->>'title'='Módulo nuevo'",
        );
        assert.equal(rows.length, 1);
        assert.equal(rows[0].module_id, null);
        assert.equal(rows[0].starter_resource_id, null);
      },
    );
    await t.test(
      "starter persistence failures roll back the resource operation",
      async () => {
        await db.exec(`CREATE FUNCTION refuse_wiki_insert() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Simulated persistence failure'; END; $$;
        CREATE TRIGGER refuse_wiki BEFORE INSERT ON wiki_guides FOR EACH ROW EXECUTE FUNCTION refuse_wiki_insert();`);
        await assert.rejects(
          db.exec(
            "INSERT INTO resources VALUES ('failed', 'failed', 'Failed module', 'module', 'en')",
          ),
          /Simulated persistence failure/,
        );
        assert.equal(
          (await db.query("SELECT id FROM resources WHERE id='failed'")).rows
            .length,
          0,
        );
      },
    );
  } finally {
    await db.close();
  }
});
