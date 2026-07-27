import { and, eq, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../db";
import { ensureDatabaseSchema } from "../../db/bootstrap";
import {
  downloads,
  files,
  resources,
  resourceVersions,
} from "../../db/schema";
import type { FileKind } from "../domain/resource";
import type { AuthorizedUser } from "../services/auth";

export async function storeResourceFile(input: {
  resourceVersionId: string;
  kind: FileKind;
  file: File;
  extension: string;
  uploadedBy: AuthorizedUser;
}): Promise<{ id: string; storageKey: string }> {
  await ensureDatabaseSchema();
  const bucket = env.FILES as R2Bucket | undefined;
  if (!bucket) throw new Error("File storage is unavailable.");

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

  await getDb().insert(files).values({
    id,
    resourceVersionId: input.resourceVersionId,
    kind: input.kind,
    storageKey,
    originalName: input.file.name.slice(0, 255),
    mimeType: input.file.type,
    extension: input.extension,
    sizeBytes: input.file.size,
  });

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
  const bucket = env.FILES as R2Bucket | undefined;
  if (!bucket) return null;
  return bucket.get(storageKey);
}

export async function readImage(storageKey: string): Promise<R2ObjectBody | null> {
  return readStoredFile(storageKey);
}
