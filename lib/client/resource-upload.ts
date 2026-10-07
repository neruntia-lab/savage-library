import { upload } from "@vercel/blob/client";
import type { FileKind } from "../domain/resource";
import { requestJson } from "./request";

export type ArtworkKind = "cover" | "thumbnail" | "icon";
export type ArtworkUrls = {
  coverUrl: string | null;
  thumbnailUrl: string | null;
  iconUrl: string | null;
};
export type UploadState = {
  phase: "idle" | "uploading" | "saving" | "complete" | "error";
  progress: number;
  fileName?: string;
  error?: string;
};
export const EMPTY_UPLOAD: UploadState = { phase: "idle", progress: 0 };

export function isArtworkKind(kind: FileKind): kind is ArtworkKind {
  return kind === "cover" || kind === "thumbnail" || kind === "icon";
}

export function normalizedMimeType(file: Pick<File, "name" | "type">): string {
  if (file.type) return file.type;
  const types: Record<string, string> = {
    zip: "application/zip",
    pdf: "application/pdf",
    json: "application/json",
    js: "text/javascript",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };
  return (
    types[file.name.split(".").pop()?.toLowerCase() ?? ""] ??
    "application/octet-stream"
  );
}

export async function uploadResourceFile(
  input: {
    resourceId: string;
    resourceVersionId: string;
    kind: FileKind;
    locale: "en" | "es";
    file: File;
    onState: (state: UploadState) => void;
  },
  uploadBlob: typeof upload = upload,
): Promise<{ url: string; artwork?: ArtworkUrls }> {
  const { resourceId, resourceVersionId, kind, file, onState } = input;
  const artwork = isArtworkKind(kind);
  const locale = artwork ? "en" : input.locale;
  const mimeType = normalizedMimeType(file);
  const metadata = {
    resourceVersionId,
    resourceId: artwork ? resourceId : undefined,
    kind,
    locale,
    originalName: file.name,
    mimeType,
    sizeBytes: file.size,
    uploadedBy: "shared-admin",
  };
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
  const pathname = artwork
    ? `resource-artwork/${resourceId}/${kind}/${crypto.randomUUID()}-${safeName}`
    : `resource-files/${resourceVersionId}/${crypto.randomUUID()}-${safeName}`;
  const blob = await uploadBlob(pathname, file, {
    access: artwork || kind === "descriptionImage" ? "public" : "private",
    handleUploadUrl: "/api/uploads",
    multipart: file.size > 20 * 1024 * 1024,
    clientPayload: JSON.stringify(metadata),
    onUploadProgress: ({ percentage }) =>
      onState({
        phase: "uploading",
        progress: Math.max(1, Math.round(percentage)),
        fileName: file.name,
      }),
  });
  if (!artwork) return { url: blob.url };
  onState({ phase: "saving", progress: 100, fileName: file.name });
  const { ok, body } = await requestJson<
    ArtworkUrls & { error?: string; resourceId?: string; persisted?: boolean }
  >("/api/uploads/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...metadata,
      url: blob.url,
      pathname: blob.pathname,
    }),
  });
  if (!ok) throw new Error(body.error ?? "The artwork could not be saved.");
  if (
    body.resourceId !== resourceId ||
    !body.persisted ||
    !body[`${kind}Url`]
  ) {
    throw new Error(
      "The server did not confirm that this image was saved. Please retry.",
    );
  }
  return { url: blob.url, artwork: body };
}
