import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { ensureDatabaseSchema } from "../../db/bootstrap";
import {
  downloads,
  files,
  resources,
  savedResources,
  users,
} from "../../db/schema";
import type { AuthorizedUser } from "../services/auth";
import { getResourceBySlug } from "./resource-repository";

export async function ensureUser(user: AuthorizedUser): Promise<void> {
  await ensureDatabaseSchema();
  await getDb()
    .insert(users)
    .values({
      id: user.id,
      email: user.email.toLowerCase(),
      displayName: user.fullName,
      role: user.isAdmin ? "admin" : "user",
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email.toLowerCase(),
        role: user.isAdmin ? "admin" : "user",
        updatedAt: new Date().toISOString(),
      },
    });
}

export async function getAccountOverview(user: AuthorizedUser) {
  try {
    await ensureUser(user);
    const db = getDb();
    const [savedRows, historyRows, profileRows] = await Promise.all([
      db
        .select({
          resourceId: savedResources.resourceId,
          slug: resources.slug,
          savedAt: savedResources.createdAt,
        })
        .from(savedResources)
        .innerJoin(resources, eq(savedResources.resourceId, resources.id))
        .where(eq(savedResources.userId, user.id))
        .orderBy(desc(savedResources.createdAt))
        .limit(24),
      db
        .select({
          id: downloads.id,
          resourceTitle: resources.title,
          resourceSlug: resources.slug,
          fileName: files.originalName,
          downloadedAt: downloads.downloadedAt,
        })
        .from(downloads)
        .innerJoin(resources, eq(downloads.resourceId, resources.id))
        .innerJoin(files, eq(downloads.fileId, files.id))
        .where(eq(downloads.userId, user.id))
        .orderBy(desc(downloads.downloadedAt))
        .limit(30),
      db
        .select({
          email: users.email,
          displayName: users.displayName,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1),
    ]);

    const saved = (
      await Promise.all(
        savedRows.map(async (row) => ({
          resource: await getResourceBySlug(row.slug),
          savedAt: row.savedAt,
        })),
      )
    ).filter(
      (
        item,
      ): item is {
        resource: NonNullable<typeof item.resource>;
        savedAt: string;
      } => Boolean(item.resource),
    );

    return {
      saved,
      history: historyRows,
      profile: profileRows[0] ?? {
        email: user.email,
        displayName: user.fullName,
        role: user.isAdmin ? "admin" : "user",
      },
    };
  } catch {
    return {
      saved: [],
      history: [],
      profile: {
        email: user.email,
        displayName: user.fullName,
        role: user.isAdmin ? "admin" : "user",
      },
    };
  }
}

export async function updateProfile(
  user: AuthorizedUser,
  displayName: string,
): Promise<void> {
  await ensureUser(user);
  await getDb()
    .update(users)
    .set({
      displayName: displayName.trim().slice(0, 80),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, user.id));
}

export async function setSavedResource(
  user: AuthorizedUser,
  resourceId: string,
  saved: boolean,
): Promise<void> {
  await ensureUser(user);
  const db = getDb();

  if (saved) {
    await db
      .insert(savedResources)
      .values({ userId: user.id, resourceId })
      .onConflictDoNothing();
    return;
  }

  await db
    .delete(savedResources)
    .where(
      and(
        eq(savedResources.userId, user.id),
        eq(savedResources.resourceId, resourceId),
      ),
    );
}

export async function getSavedResourceIds(
  user: AuthorizedUser,
  resourceIds: string[],
): Promise<Set<string>> {
  if (!resourceIds.length) return new Set();
  await ensureUser(user);
  const rows = await getDb()
    .select({ resourceId: savedResources.resourceId })
    .from(savedResources)
    .where(
      and(
        eq(savedResources.userId, user.id),
        inArray(savedResources.resourceId, resourceIds),
      ),
    );
  return new Set(rows.map((row) => row.resourceId));
}
