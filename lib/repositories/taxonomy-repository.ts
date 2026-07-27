import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { ensureDatabaseSchema } from "../../db/bootstrap";
import { authors, categories, gameSystems, tags } from "../../db/schema";

export type TaxonomyType = "author" | "category" | "system" | "tag";

export async function createTaxonomyEntry(input: {
  type: TaxonomyType;
  name: string;
  slug: string;
}): Promise<string> {
  await ensureDatabaseSchema();
  const id = `${input.type}-${crypto.randomUUID()}`;
  const values = { id, name: input.name, slug: input.slug };
  const db = getDb();

  switch (input.type) {
    case "author":
      await db.insert(authors).values(values);
      break;
    case "category":
      await db.insert(categories).values({ ...values, description: "" });
      break;
    case "system":
      await db.insert(gameSystems).values(values);
      break;
    case "tag":
      await db.insert(tags).values(values);
      break;
  }
  return id;
}

export async function updateTaxonomyEntry(input: {
  type: TaxonomyType;
  id: string;
  name: string;
  slug: string;
}): Promise<boolean> {
  await ensureDatabaseSchema();
  const db = getDb();
  const values = {
    name: input.name,
    slug: input.slug,
    updatedAt: new Date().toISOString(),
  };

  switch (input.type) {
    case "author":
      return Boolean(
        (
          await db
            .update(authors)
            .set(values)
            .where(eq(authors.id, input.id))
            .returning({ id: authors.id })
        )[0],
      );
    case "category":
      return Boolean(
        (
          await db
            .update(categories)
            .set(values)
            .where(eq(categories.id, input.id))
            .returning({ id: categories.id })
        )[0],
      );
    case "system":
      return Boolean(
        (
          await db
            .update(gameSystems)
            .set(values)
            .where(eq(gameSystems.id, input.id))
            .returning({ id: gameSystems.id })
        )[0],
      );
    case "tag":
      return Boolean(
        (
          await db
            .update(tags)
            .set(values)
            .where(eq(tags.id, input.id))
            .returning({ id: tags.id })
        )[0],
      );
  }
}

export async function deleteTaxonomyEntry(
  type: TaxonomyType,
  id: string,
): Promise<boolean> {
  await ensureDatabaseSchema();
  const db = getDb();
  switch (type) {
    case "author":
      return Boolean(
        (
          await db
            .delete(authors)
            .where(eq(authors.id, id))
            .returning({ id: authors.id })
        )[0],
      );
    case "category":
      return Boolean(
        (
          await db
            .delete(categories)
            .where(eq(categories.id, id))
            .returning({ id: categories.id })
        )[0],
      );
    case "system":
      return Boolean(
        (
          await db
            .delete(gameSystems)
            .where(eq(gameSystems.id, id))
            .returning({ id: gameSystems.id })
        )[0],
      );
    case "tag":
      return Boolean(
        (
          await db
            .delete(tags)
            .where(eq(tags.id, id))
            .returning({ id: tags.id })
        )[0],
      );
  }
}
