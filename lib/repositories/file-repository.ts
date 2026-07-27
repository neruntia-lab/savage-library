import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { ensureDatabaseSchema } from "../../db/bootstrap";
import {
  downloads,
  files,
  resources,
  resourceVersions,
} from "../../db/schema";
import type { FileKind } from "../domain/resource";
import { getFileBucketBinding } from "../platform/bindings";
import type { AuthorizedUser } from "../services/auth";

export async function storeResourceFile(input: {
  resourceVersionId: string;
  kind: FileKind;
  file: File;
  extension: string;
  uploadedBy: AuthorizedUser;
}): Promise<{ id: string; storageKey: string }> {
  await ensureDatabaseSchema();
  const bucket = getFileBucketBinding();
  if (!bucket) throw new Error("File storage is unavailable.");
  const db = getDb();
  const resourceRows = await db
    .select({
      id: resources.id,
      coverKey: resources.coverKey,
      thumbnailKey: resources.thumbnailKey,
    })
    .from(resourceVersions)
    .innerJoin(resources, eq(resourceVersions.resourceId, resources.id))
    .where(eq(resourceVersions.id, input.resourceVersionId))
    .limit(1);
  const resource = resourceRows[0];
  if (!resource) throw new Error("Resource version not found.");

  const id = crypto.randomUUID();
  const safeName = input.file.name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  const storageKey = `resource-files/${input.resourceVersionId}/${id}-${safeName}`;

  await bucket.put(storageKey, input.file.stream(), {
    httpMetadata: {
      contentType: input.file.type,
      contentDisposition: `attachment; filename="${safeName}"`,
    },
    customMetadata: {
      uploadedBy: input.uploadedBy.id,
      kind: input.kind,
    },
  });

  const insertFile = db.insert(files).values({
    id,
    resourceVersionId: input.resourceVersionId,
    kind: input.kind,
    storageKey,
    originalName: input.file.name.slice(0, 255),
    mimeType: input.file.type,
    extension: input.extension,
    sizeBytes: input.file.size,
  });

  try {
    if (input.kind === "cover") {
      await db.batch([
        insertFile,
        db
          .update(resources)
          .set({ coverKey: storageKey, updatedAt: new Date().toISOString() })
          .where(eq(resources.id, resource.id)),
      ]);
    } else if (input.kind === "thumbnail") {
      await db.batch([
        insertFile,
        db
          .update(resources)
          .set({
            thumbnailKey: storageKey,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(resources.id, resource.id)),
      ]);
    } else {
      await insertFile;
    }
  } catch (error) {
    await bucket.delete(storageKey);
    throw error;
  }

  const replacedKey =
    input.kind === "cover"
      ? resource.coverKey
      : input.kind === "thumbnail"
        ? resource.thumbnailKey
        : null;
  if (replacedKey && replacedKey !== storageKey) {
    await bucket.delete(replacedKey);
    await db.delete(files).where(eq(files.storageKey, replacedKey));
  }

  return { id, storageKey };
}

export async function getDownloadRecord(fileId: string) {
  await ensureDatabaseSchema();
  const rows = await getDb()
    .select({
      file: files,
      resource: resources,
    })
    .from(files)
    .innerJoin(
      resourceVersions,
      eq(files.resourceVersionId, resourceVersions.id),
    )
    .innerJoin(resources, eq(resourceVersions.resourceId, resources.id))
    .where(and(eq(files.id, fileId), eq(resources.isPublished, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function recordDownload(input: {
  resourceId: string;
  fileId: string;
  user?: AuthorizedUser | null;
  visitorHash?: string;
}): Promise<void> {
  await ensureDatabaseSchema();
  const db = getDb();
  await db.batch([
    db.insert(downloads).values({
      id: crypto.randomUUID(),
      resourceId: input.resourceId,
      fileId: input.fileId,
      userId: input.user?.id,
      visitorHash: input.visitorHash,
    }),
    db
      .update(resources)
      .set({
        downloadCount: sql`${resources.downloadCount} + 1`,
        popularityScore: sql`${resources.popularityScore} + 1`,
      })
      .where(eq(resources.id, input.resourceId)),
  ]);
}

export async function readStoredFile(storageKey: string): Promise<R2ObjectBody | null> {
  const bucket = getFileBucketBinding();
  if (!bucket) return null;
  return bucket.get(storageKey);
}

export async function readImage(storageKey: string): Promise<R2ObjectBody | null> {
  await ensureDatabaseSchema();
  const rows = await getDb()
    .select({ kind: files.kind, mimeType: files.mimeType })
    .from(files)
    .where(eq(files.storageKey, storageKey))
    .limit(1);
  const metadata = rows[0];
  if (
    !metadata ||
    !["cover", "thumbnail"].includes(metadata.kind) ||
    !metadata.mimeType.startsWith("image/")
  ) {
    return null;
  }
  return readStoredFile(storageKey);
}
