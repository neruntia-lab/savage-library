ALTER TABLE "wiki_guides" ADD COLUMN "starter_resource_id" text;--> statement-breakpoint
ALTER TABLE "wiki_guides" ADD CONSTRAINT "wiki_guides_starter_resource_id_resources_id_fk" FOREIGN KEY ("starter_resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_starter_resource_unique" ON "wiki_guides" USING btree ("starter_resource_id");
--> statement-breakpoint
-- The resource row lock serializes backfill, updates and retries for one module.
-- Provenance survives manual unlinking; edited or existing guides are never replaced.
CREATE FUNCTION ensure_module_wiki_draft(resource_id text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  source resources%ROWTYPE;
  locale text;
  candidate_slug text;
  slug_base text;
  attempt integer := 0;
BEGIN
  SELECT * INTO source FROM resources WHERE id = resource_id FOR UPDATE;
  IF NOT FOUND OR source.resource_type <> 'module' THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM wiki_guides
    WHERE starter_resource_id = source.id
       OR module_id = source.id OR published_module_id = source.id
  ) THEN RETURN; END IF;

  locale := CASE WHEN source.default_locale = 'es' THEN 'es' ELSE 'en' END;
  slug_base := 'module-' || md5(source.id);
  LOOP
    candidate_slug := slug_base || CASE WHEN attempt = 0 THEN '' ELSE '-' || attempt END;
    IF NOT EXISTS (SELECT 1 FROM wiki_guides
      WHERE slug = candidate_slug OR published_slug = candidate_slug) THEN
      BEGIN
        INSERT INTO wiki_guides (id, slug, draft, module_id, starter_resource_id, updated_by)
        VALUES (gen_random_uuid()::text, candidate_slug,
          jsonb_build_object('defaultLocale', locale, 'translations',
            jsonb_build_object(
              'en', jsonb_build_object('title', CASE WHEN locale = 'en' THEN source.title ELSE '' END,
                'summary', '', 'body', ''),
              'es', jsonb_build_object('title', CASE WHEN locale = 'es' THEN source.title ELSE '' END,
                'summary', '', 'body', ''))),
          source.id, source.id, 'system:module-wiki')
        ON CONFLICT (starter_resource_id) DO NOTHING;
        RETURN;
      EXCEPTION WHEN unique_violation THEN
        -- A concurrent unrelated guide may claim the proposed slug. Retry safely.
      END;
    END IF;
    attempt := attempt + 1;
    IF attempt > 1000 THEN
      RAISE EXCEPTION 'Unable to allocate a module Wiki slug';
    END IF;
  END LOOP;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION create_module_wiki_draft() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM ensure_module_wiki_draft(NEW.id);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER resource_module_wiki_draft
AFTER INSERT OR UPDATE OF resource_type ON resources
FOR EACH ROW EXECUTE FUNCTION create_module_wiki_draft();
--> statement-breakpoint
SELECT ensure_module_wiki_draft(id) FROM resources WHERE resource_type = 'module';
