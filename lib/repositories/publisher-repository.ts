import { del, get, list, put, type PutBlobResult } from "@vercel/blob";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { privateBlobToken } from "../config/blob";
import { foundryManifestUrl, resourcePublicUrl } from "../config/site";
import {
  authors,
  changelogEntries,
  files,
  resources,
  resourceVersions,
} from "../../db/schema";
import {
  hashPublisherToken,
  inspectFoundryModule,
  isFoundryVersion,
  type FoundryManifest,
  sha256Hex,
} from "../foundry/publisher";

export async function authenticatePublisherToken(resourceId: string, token: string) {
  const rows = await getDb()
    .select({ hash: resources.publisherTokenHash })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1);
  return Boolean(rows[0]?.hash && rows[0].hash === (await hashPublisherToken(token)));
}

export type PublisherVerificationCode =
  | "publisher_token_invalid"
  | "module_resource_mismatch"
  | "resource_not_found"
  | "version_conflict"
  | "private_storage_missing"
  | "private_storage_rejected";

export class PublisherVerificationError extends Error {
  constructor(
    public readonly code: PublisherVerificationCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PublisherVerificationError";
  }
}

export async function verifyPublisherConfiguration(input: {
  resourceId: string;
  token: string;
  moduleId: string;
  version?: string;
  checksum?: string;
  checkStorage?: boolean;
}) {
  const rows = await getDb()
    .select({
      id: resources.id,
      title: resources.title,
      slug: resources.slug,
      resourceType: resources.resourceType,
      foundryModuleId: resources.foundryModuleId,
      accessMode: resources.accessMode,
      isPublished: resources.isPublished,
      publisherTokenHash: resources.publisherTokenHash,
    })
    .from(resources)
    .where(eq(resources.id, input.resourceId))
    .limit(1);
  const resource = rows[0];
  if (!resource || resource.resourceType !== "module") {
    throw new PublisherVerificationError(
      "resource_not_found",
      404,
      "The linked module resource was not found.",
    );
  }
  if (
    !resource.publisherTokenHash ||
    resource.publisherTokenHash !== (await hashPublisherToken(input.token))
  ) {
    throw new PublisherVerificationError(
      "publisher_token_invalid",
      401,
      "The publisher token is invalid or has been rotated.",
    );
  }
  if (resource.foundryModuleId && resource.foundryModuleId !== input.moduleId) {
    throw new PublisherVerificationError(
      "module_resource_mismatch",
      403,
      `This resource belongs to module id "${resource.foundryModuleId}".`,
    );
  }
  if (input.version) {
    const existing = await getDb()
      .select({ checksum: resourceVersions.artifactChecksum })
      .from(resourceVersions)
      .where(
        and(
          eq(resourceVersions.resourceId, resource.id),
          eq(resourceVersions.version, input.version),
        ),
      )
      .limit(1);
    if (
      existing[0]?.checksum &&
      input.checksum &&
      existing[0].checksum !== input.checksum
    ) {
      throw new PublisherVerificationError(
        "version_conflict",
        409,
        `Version ${input.version} already exists with different contents.`,
      );
    }
  }
  if (input.checkStorage !== false) {
    const token = privateBlobToken();
    if (!token) {
      throw new PublisherVerificationError(
        "private_storage_missing",
        503,
        "Private module storage is not configured.",
      );
    }
    try {
      await list({ token, limit: 1, prefix: `foundry-release-uploads/${resource.id}/` });
    } catch {
      throw new PublisherVerificationError(
        "private_storage_rejected",
        503,
        "Private module storage rejected the configured credential.",
      );
    }
  }
  return {
    id: resource.id,
    title: resource.title,
    slug: resource.slug,
    moduleId: resource.foundryModuleId ?? input.moduleId,
    accessMode: resource.accessMode,
    isPublished: resource.isPublished,
    storageReady: input.checkStorage !== false ? (true as const) : undefined,
  };
}

export async function getPublisherReleaseStatus(input: {
  resourceId: string;
  token: string;
  moduleId: string;
  version: string;
  checksum: string;
}) {
  const resource = await verifyPublisherConfiguration({
    ...input,
    checkStorage: false,
  });
  const rows = await getDb()
    .select({
      id: resourceVersions.id,
      status: resourceVersions.releaseStatus,
      checksum: resourceVersions.artifactChecksum,
      errors: resourceVersions.validationErrors,
    })
    .from(resourceVersions)
    .where(
      and(
        eq(resourceVersions.resourceId, input.resourceId),
        eq(resourceVersions.version, input.version),
      ),
    )
    .limit(1);
  const release = rows[0];
  return {
    resource,
    release: release
      ? {
          id: release.id,
          status: release.status,
          checksum: release.checksum,
          errors: JSON.parse(release.errors || "[]") as string[],
        }
      : null,
  };
}

export async function rotatePublisherToken(resourceId: string) {
  const token = `slp_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const updated = await getDb()
    .update(resources)
    .set({
      publisherTokenHash: await hashPublisherToken(token),
      publisherTokenCreatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(resources.id, resourceId), eq(resources.resourceType, "module")))
    .returning({ id: resources.id });
  if (!updated[0]) throw new Error("Module resource not found.");
  return token;
}

export async function createReleaseDraft(input: {
  resourceId: string;
  file: File;
  source: "admin" | "cli";
  uploadedBy: string;
}) {
  if (!input.file.name.toLowerCase().endsWith(".zip")) throw new Error("Select a ZIP archive.");
  if (input.file.size > 250 * 1024 * 1024) throw new Error("Module ZIP files may not exceed 250 MB.");

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const versionId = crypto.randomUUID();
  const token = privateBlobToken();
  if (!token) throw new Error("Private module storage is unavailable.");
  const blob = await put(
    `foundry-releases/${input.resourceId}/${versionId}/${input.file.name}`,
    Buffer.from(bytes),
    {
      access: "private",
      token,
      contentType: "application/zip",
      addRandomSuffix: false,
    },
  );
  try {
    const draft = await createReleaseDraftFromBytes({
      resourceId: input.resourceId,
      bytes,
      blob,
      originalName: input.file.name,
      sizeBytes: input.file.size,
      source: input.source,
      uploadedBy: input.uploadedBy,
      versionId,
    });
    if (draft.reused) await del(blob.url, { token }).catch(() => undefined);
    return draft;
  } catch (error) {
    await del(blob.url, { token }).catch(() => undefined);
    throw error;
  }
}

export async function createReleaseDraftFromUploadedBlob(input: {
  resourceId: string;
  blob: Pick<PutBlobResult, "url" | "pathname">;
  originalName: string;
  sizeBytes: number;
  source: "admin" | "cli";
  uploadedBy: string;
}) {
  const token = privateBlobToken();
  if (!token) throw new Error("Private module storage is unavailable.");
  const result = await get(input.blob.pathname, { access: "private", token });
  if (!result || result.statusCode !== 200) throw new Error("Uploaded module could not be read.");
  const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
  try {
    const draft = await createReleaseDraftFromBytes({
      ...input,
      sizeBytes: result.blob.size,
      bytes,
      versionId: crypto.randomUUID(),
    });
    if (draft.reused) await del(input.blob.url, { token }).catch(() => undefined);
    return draft;
  } catch (error) {
    await del(input.blob.url, { token }).catch(() => undefined);
    throw error;
  }
}

async function createReleaseDraftFromBytes(input: {
  resourceId: string;
  bytes: Uint8Array;
  blob: Pick<PutBlobResult, "url" | "pathname">;
  originalName: string;
  sizeBytes: number;
  source: "admin" | "cli";
  uploadedBy: string;
  versionId: string;
}) {
  const db = getDb();
  const resourceRows = await db
    .select()
    .from(resources)
    .where(eq(resources.id, input.resourceId))
    .limit(1);
  const resource = resourceRows[0];
  if (!resource) throw new Error("Resource not found.");
  if (resource.resourceType !== "module") throw new Error("Only Foundry modules can use module releases.");

  const bytes = input.bytes;
  const inspected = inspectFoundryModule(bytes, resource.foundryModuleId);
  const manifest = inspected.manifest;
  const validationErrors = [...inspected.errors];
  if (manifest) {
    const expectedUrl = resourcePublicUrl(resource.slug);
    const expectedManifest = foundryManifestUrl(resource.slug);
    if (manifest.url !== expectedUrl) {
      validationErrors.push(`module.json url must be ${expectedUrl}.`);
    }
    if (manifest.manifest !== expectedManifest) {
      validationErrors.push(`module.json manifest must be ${expectedManifest}.`);
    }
  }
  const checksum = await sha256Hex(bytes);
  const duplicate = manifest
    ? await db
        .select({
          id: resourceVersions.id,
          status: resourceVersions.releaseStatus,
          checksum: resourceVersions.artifactChecksum,
          snapshot: resourceVersions.manifestSnapshot,
          errors: resourceVersions.validationErrors,
        })
        .from(resourceVersions)
        .where(
          and(
            eq(resourceVersions.resourceId, resource.id),
            eq(resourceVersions.version, manifest.version),
          ),
        )
        .limit(1)
    : [];
  if (duplicate[0] && manifest) {
    if (duplicate[0].checksum === checksum) {
      return {
        id: duplicate[0].id,
        status: duplicate[0].status,
        manifest: JSON.parse(duplicate[0].snapshot ?? "{}") as FoundryManifest,
        errors: JSON.parse(duplicate[0].errors) as string[],
        reused: true,
      };
    }
    if (!duplicate[0].checksum && !duplicate[0].snapshot) {
      const now = new Date().toISOString();
      const status = validationErrors.length ? "failed" : "draft";
      const releaseQuery = db
        .update(resourceVersions)
        .set({
          foundryMinimum: manifest.compatibility?.minimum,
          foundryVerified: manifest.compatibility?.verified,
          foundryMaximum: manifest.compatibility?.maximum,
          isCurrent: false,
          releaseStatus: status,
          manifestSnapshot: JSON.stringify(manifest),
          validationErrors: JSON.stringify(validationErrors),
          uploadSource: input.source,
          artifactChecksum: checksum,
          artifactSize: input.sizeBytes,
          releasedAt: now,
          publishedAt: null,
          updatedAt: now,
        })
        .where(eq(resourceVersions.id, duplicate[0].id));
      const fileQuery = db.insert(files).values({
        id: crypto.randomUUID(),
        resourceVersionId: duplicate[0].id,
        kind: "module",
        locale: "en",
        storageKey: input.blob.pathname,
        storageUrl: input.blob.url,
        originalName: input.originalName.slice(0, 255),
        mimeType: "application/zip",
        extension: "zip",
        sizeBytes: input.sizeBytes,
        checksum,
        uploadedBy: input.uploadedBy,
        isRestricted: true,
        createdAt: now,
        updatedAt: now,
      });
      await db.batch([releaseQuery, fileQuery]);
      return {
        id: duplicate[0].id,
        status,
        manifest,
        errors: validationErrors,
        reused: false,
      };
    }
    throw new Error(`Version ${manifest.version} already exists with different contents.`);
  }

  const versionId = input.versionId;
  const now = new Date().toISOString();
  const status = validationErrors.length ? "failed" : "draft";
  const version = manifest?.version ?? `invalid-${versionId.slice(0, 8)}`;

  const releaseQuery = db.insert(resourceVersions).values({
    id: versionId,
    resourceId: resource.id,
    version,
    foundryMinimum: manifest?.compatibility?.minimum,
    foundryVerified: manifest?.compatibility?.verified,
    foundryMaximum: manifest?.compatibility?.maximum,
    isCurrent: false,
    releasedAt: now,
    releaseStatus: status,
    manifestSnapshot: manifest ? JSON.stringify(manifest) : null,
    validationErrors: JSON.stringify(validationErrors),
    uploadSource: input.source,
    artifactChecksum: checksum,
    artifactSize: input.sizeBytes,
    createdAt: now,
    updatedAt: now,
  });
  const fileQuery = db.insert(files).values({
    id: crypto.randomUUID(),
    resourceVersionId: versionId,
    kind: "module",
    locale: "en",
    storageKey: input.blob.pathname,
    storageUrl: input.blob.url,
    originalName: input.originalName.slice(0, 255),
    mimeType: "application/zip",
    extension: "zip",
    sizeBytes: input.sizeBytes,
    checksum,
    uploadedBy: input.uploadedBy,
    isRestricted: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.batch([releaseQuery, fileQuery]);
  return { id: versionId, status, manifest, errors: validationErrors, reused: false };
}

export async function listModuleReleases(resourceId: string) {
  return getDb()
    .select({
      id: resourceVersions.id,
      version: resourceVersions.version,
      status: resourceVersions.releaseStatus,
      foundryMinimum: resourceVersions.foundryMinimum,
      foundryVerified: resourceVersions.foundryVerified,
      foundryMaximum: resourceVersions.foundryMaximum,
      checksum: resourceVersions.artifactChecksum,
      size: resourceVersions.artifactSize,
      source: resourceVersions.uploadSource,
      errors: resourceVersions.validationErrors,
      summary: resourceVersions.changelogSummary,
      details: resourceVersions.changelogDetails,
      releasedAt: resourceVersions.releasedAt,
      publishedAt: resourceVersions.publishedAt,
      isCurrent: resourceVersions.isCurrent,
    })
    .from(resourceVersions)
    .where(eq(resourceVersions.resourceId, resourceId))
    .orderBy(desc(resourceVersions.createdAt));
}

export async function updateReleaseDraft(
  resourceId: string,
  releaseId: string,
  input: {
    foundryMinimum?: string;
    foundryVerified?: string;
    foundryMaximum?: string;
    summary?: string;
    details?: string;
    releasedAt?: string;
  },
) {
  if (
    !isFoundryVersion(input.foundryMinimum) ||
    !isFoundryVersion(input.foundryVerified) ||
    !isFoundryVersion(input.foundryMaximum)
  ) {
    throw new Error("Foundry compatibility values must contain one to three numeric components.");
  }
  const result = await getDb()
    .update(resourceVersions)
    .set({
      foundryMinimum: input.foundryMinimum,
      foundryVerified: input.foundryVerified,
      foundryMaximum: input.foundryMaximum,
      changelogSummary: input.summary?.slice(0, 500) ?? "",
      changelogDetails: input.details?.slice(0, 20_000) ?? "",
      releasedAt: input.releasedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(resourceVersions.id, releaseId),
        eq(resourceVersions.resourceId, resourceId),
        eq(resourceVersions.releaseStatus, "draft"),
      ),
    )
    .returning({ id: resourceVersions.id });
  return Boolean(result[0]);
}

export async function publishRelease(
  resourceId: string,
  releaseId: string,
  siteOrigin: string,
) {
  const db = getDb();
  const rows = await db
    .select({ release: resourceVersions, resource: resources })
    .from(resourceVersions)
    .innerJoin(resources, eq(resourceVersions.resourceId, resources.id))
    .where(
      and(
        eq(resourceVersions.id, releaseId),
        eq(resourceVersions.resourceId, resourceId),
        eq(resourceVersions.releaseStatus, "draft"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Draft release not found.");
  if (row.resource.accessMode !== "public") {
    throw new Error("Paid modules cannot publish a public Foundry manifest in this release.");
  }
  if (!row.resource.isPublished) {
    throw new Error("Publish the catalog resource before activating its Foundry release.");
  }
  if (
    !row.release.manifestSnapshot ||
    !row.release.artifactChecksum ||
    !row.release.artifactSize
  ) {
    throw new Error("This release does not have a validated module ZIP.");
  }
  const validationErrors = JSON.parse(row.release.validationErrors) as unknown;
  if (Array.isArray(validationErrors) && validationErrors.length) {
    throw new Error("Resolve the release validation errors before publishing.");
  }
  const artifacts = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        eq(files.resourceVersionId, releaseId),
        eq(files.kind, "module"),
      ),
    )
    .limit(1);
  if (!artifacts[0]) {
    throw new Error("This release does not have a module ZIP to publish.");
  }
  const manifest = JSON.parse(row.release.manifestSnapshot ?? "{}") as FoundryManifest;
  if (
    !manifest.id ||
    manifest.version !== row.release.version ||
    (row.resource.foundryModuleId && manifest.id !== row.resource.foundryModuleId)
  ) {
    throw new Error("The release manifest does not match this module resource.");
  }
  const now = new Date().toISOString();
  const manifestUrl = `${siteOrigin.replace(/\/+$/, "")}/api/foundry/modules/${row.resource.slug}/module.json`;

  const supersedeQuery = db
      .update(resourceVersions)
      .set({
        isCurrent: false,
        releaseStatus: "superseded",
        supersededAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(resourceVersions.resourceId, resourceId),
          eq(resourceVersions.isCurrent, true),
        ),
      );
  const publishQuery = db
      .update(resourceVersions)
      .set({
        isCurrent: true,
        releaseStatus: "published",
        publishedAt: now,
        supersededAt: null,
        updatedAt: now,
      })
      .where(eq(resourceVersions.id, releaseId));
  const resourceQuery = db
      .update(resources)
      .set({
        foundryModuleId: row.resource.foundryModuleId ?? manifest.id,
        activeReleaseId: releaseId,
        currentVersion: row.release.version,
        foundryMinimum: row.release.foundryMinimum,
        foundryVerified: row.release.foundryVerified,
        foundryMaximum: row.release.foundryMaximum,
        manifestUrl,
        updatedAt: now,
      })
      .where(eq(resources.id, resourceId));
  if (row.release.changelogSummary || row.release.changelogDetails) {
    const changelogQuery = db.insert(changelogEntries).values({
        id: crypto.randomUUID(),
        resourceVersionId: releaseId,
        summary: row.release.changelogSummary,
        details: row.release.changelogDetails,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    await db.batch([supersedeQuery, publishQuery, resourceQuery, changelogQuery]);
  } else {
    await db.batch([supersedeQuery, publishQuery, resourceQuery]);
  }
}

export async function rejectRelease(resourceId: string, releaseId: string) {
  const result = await getDb()
    .update(resourceVersions)
    .set({
      releaseStatus: "rejected",
      rejectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(resourceVersions.id, releaseId),
        eq(resourceVersions.resourceId, resourceId),
        inArray(resourceVersions.releaseStatus, ["draft", "failed"]),
      ),
    )
    .returning({ id: resourceVersions.id });
  return Boolean(result[0]);
}

export async function rollbackRelease(resourceId: string, releaseId: string) {
  const db = getDb();
  const rows = await db
    .select({ release: resourceVersions, resource: resources })
    .from(resourceVersions)
    .innerJoin(resources, eq(resourceVersions.resourceId, resources.id))
    .where(
      and(
        eq(resourceVersions.id, releaseId),
        eq(resourceVersions.resourceId, resourceId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || !["published", "superseded"].includes(row.release.releaseStatus)) {
    throw new Error("Published release not found.");
  }
  if (row.resource.accessMode !== "public") throw new Error("Paid modules cannot expose public manifests.");
  const now = new Date().toISOString();
  const clearCurrentQuery = db
    .update(resourceVersions)
    .set({
      isCurrent: false,
      releaseStatus: "superseded",
      supersededAt: now,
      updatedAt: now,
    })
    .where(eq(resourceVersions.resourceId, resourceId));
  const activateQuery = db.update(resourceVersions).set({ isCurrent: true, releaseStatus: "published", supersededAt: null, updatedAt: now }).where(eq(resourceVersions.id, releaseId));
  const updateResourceQuery = db.update(resources).set({
      activeReleaseId: releaseId,
      currentVersion: row.release.version,
      foundryMinimum: row.release.foundryMinimum,
      foundryVerified: row.release.foundryVerified,
      foundryMaximum: row.release.foundryMaximum,
      updatedAt: now,
    }).where(eq(resources.id, resourceId));
  await db.batch([clearCurrentQuery, activateQuery, updateResourceQuery]);
}

export async function getActiveFoundryRelease(slug: string) {
  const rows = await getDb()
    .select({
      resource: resources,
      release: resourceVersions,
      file: files,
      author: authors,
    })
    .from(resources)
    .innerJoin(authors, eq(resources.authorId, authors.id))
    .innerJoin(
      resourceVersions,
      and(
        eq(resourceVersions.resourceId, resources.id),
        eq(resourceVersions.isCurrent, true),
      ),
    )
    .innerJoin(
      files,
      and(
        eq(files.resourceVersionId, resourceVersions.id),
        eq(files.kind, "module"),
      ),
    )
    .where(
      and(
        eq(resources.slug, slug),
        eq(resources.isPublished, true),
        eq(resources.accessMode, "public"),
        eq(resourceVersions.releaseStatus, "published"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getPublicFoundryArtifact(slug: string, releaseId: string) {
  const rows = await getDb()
    .select({ resource: resources, release: resourceVersions, file: files })
    .from(resources)
    .innerJoin(resourceVersions, eq(resourceVersions.resourceId, resources.id))
    .innerJoin(
      files,
      and(
        eq(files.resourceVersionId, resourceVersions.id),
        eq(files.kind, "module"),
      ),
    )
    .where(
      and(
        eq(resources.slug, slug),
        eq(resources.isPublished, true),
        eq(resources.accessMode, "public"),
        eq(resourceVersions.id, releaseId),
        inArray(resourceVersions.releaseStatus, ["published", "superseded"]),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
