import {
  del,
  get,
  issueSignedToken,
  presignUrl,
  put,
  type PutBlobResult,
} from "@vercel/blob";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  downloads,
  files,
  resourcePatreonTiers,
  resources,
  resourceVersions,
} from "../../db/schema";
import type { FileKind } from "../domain/resource";
import type { AuthorizedUser } from "../services/auth";

export type UploadedBlobInput = {
  resourceVersionId: string;
  kind: FileKind;
  locale: "en" | "es";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  extension: string;
  uploadedBy: string;
  blob: Pick<PutBlobResult, "url" | "pathname">;
};

export async function storeResourceFile(input: {
  resourceVersionId: string;
  kind: FileKind;
  locale?: "en" | "es";
  file: File;
  extension: string;
  uploadedBy: AuthorizedUser;
}): Promise<{ id: string; storageKey: string }> {
  const isMedia = input.kind === "cover" || input.kind === "thumbnail";
  const token = isMedia
    ? process.env.PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN
    : process.env.PRIVATE_CONTENT_BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("File storage is unavailable.");

  const blob = await put(
    `resource-files/${input.resourceVersionId}/${input.file.name}`,
    input.file,
    {
      access: isMedia ? "public" : "private",
      addRandomSuffix: true,
      token,
      contentType: input.file.type,
    },
  );
  return recordUploadedBlob({
    resourceVersionId: input.resourceVersionId,
    kind: input.kind,
    locale: input.locale ?? "en",
    originalName: input.file.name,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    extension: input.extension,
    uploadedBy: input.uploadedBy.id,
    blob,
  });
}

export async function recordUploadedBlob(
  input: UploadedBlobInput,
): Promise<{ id: string; storageKey: string }> {
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

  const existingRows = await db
    .select({ id: files.id, storageUrl: files.storageUrl })
    .from(files)
    .where(
      and(
        eq(files.resourceVersionId, input.resourceVersionId),
        eq(files.kind, input.kind),
        eq(files.locale, input.locale),
      ),
    )
    .limit(1);
  const id = existingRows[0]?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(files)
    .values({
      id,
      resourceVersionId: input.resourceVersionId,
      kind: input.kind,
      locale: input.locale,
      storageKey: input.blob.pathname,
      storageUrl: input.blob.url,
      originalName: input.originalName.slice(0, 255),
      mimeType: input.mimeType,
      extension: input.extension,
      sizeBytes: input.sizeBytes,
      uploadedBy: input.uploadedBy,
      isRestricted: input.kind !== "cover" && input.kind !== "thumbnail",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [files.resourceVersionId, files.kind, files.locale],
      set: {
        storageKey: input.blob.pathname,
        storageUrl: input.blob.url,
        originalName: input.originalName.slice(0, 255),
        mimeType: input.mimeType,
        extension: input.extension,
        sizeBytes: input.sizeBytes,
        uploadedBy: input.uploadedBy,
        updatedAt: now,
      },
    });

  if (input.kind === "cover" || input.kind === "thumbnail") {
    await db
      .update(resources)
      .set({
        ...(input.kind === "cover"
          ? { coverKey: input.blob.url }
          : { thumbnailKey: input.blob.url }),
        updatedAt: now,
      })
      .where(eq(resources.id, resource.id));
  }

  const oldUrl = existingRows[0]?.storageUrl;
  if (oldUrl && oldUrl !== input.blob.url) {
    await deleteBlobBestEffort(oldUrl);
  }

  return { id, storageKey: input.blob.pathname };
}

export async function getDownloadRecord(fileId: string) {
  const db = getDb();
  const rows = await db
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
  const row = rows[0];
  if (!row) return null;

  const tierRows =
    row.resource.accessMode === "patreon"
      ? await db
          .select({ tierId: resourcePatreonTiers.tierId })
          .from(resourcePatreonTiers)
          .where(eq(resourcePatreonTiers.resourceId, row.resource.id))
      : [];

  return { ...row, allowedTierIds: tierRows.map((entry) => entry.tierId) };
}

export async function recordDownload(input: {
  resourceId: string;
  fileId: string;
  user?: AuthorizedUser | null;
  visitorHash?: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(downloads).values({
    id: crypto.randomUUID(),
    resourceId: input.resourceId,
    fileId: input.fileId,
    visitorHash: input.visitorHash,
  });
  await db
    .update(resources)
    .set({
      downloadCount: sql`${resources.downloadCount} + 1`,
      popularityScore: sql`${resources.popularityScore} + 1`,
    })
    .where(eq(resources.id, input.resourceId));
}

export async function createSignedDownloadUrl(
  pathname: string,
): Promise<string> {
  const token = process.env.PRIVATE_CONTENT_BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Private file storage is unavailable.");
  const validUntil = Date.now() + 2 * 60 * 1_000;
  const signed = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
    token,
  });
  const result = await presignUrl(signed, {
    operation: "get",
    pathname,
    validUntil,
    access: "private",
  });
  return result.presignedUrl;
}

export async function deleteStoredFile(fileId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .delete(files)
    .where(eq(files.id, fileId))
    .returning({ storageUrl: files.storageUrl });
  if (!rows[0]) return false;
  if (rows[0].storageUrl) await deleteBlobBestEffort(rows[0].storageUrl);
  return true;
}

export async function readStoredFile(storageKey: string) {
  const token = process.env.PRIVATE_CONTENT_BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  return get(storageKey, { access: "private", token });
}

export async function readImage(storageKey: string) {
  if (/^https?:\/\//.test(storageKey)) return null;
  const token = process.env.PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  return get(storageKey, { access: "public", token });
}

async function deleteBlobBestEffort(url: string): Promise<void> {
  const isPublic = url.includes(".public.blob.vercel-storage.com");
  const token = isPublic
    ? process.env.PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN
    : process.env.PRIVATE_CONTENT_BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  await del(url, { token }).catch(() => undefined);
}
