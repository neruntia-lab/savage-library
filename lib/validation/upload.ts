import type { FileKind } from "../domain/resource";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const FILE_RULES: Record<
  FileKind,
  { extensions: readonly string[]; mimeTypes: readonly string[] }
> = {
  pdf: {
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
  },
  module: {
    extensions: [".zip"],
    mimeTypes: [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ],
  },
  cover: {
    extensions: [".png", ".jpg", ".jpeg", ".webp"],
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  thumbnail: {
    extensions: [".png", ".jpg", ".jpeg", ".webp"],
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  manifest: {
    extensions: [".json"],
    mimeTypes: ["application/json", "text/json"],
  },
};

export function validateUpload(
  file: File,
  kind: FileKind,
): { valid: true; extension: string } | { valid: false; message: string } {
  const rules = FILE_RULES[kind];
  const extension = extensionOf(file.name);

  if (!rules.extensions.includes(extension)) {
    return {
      valid: false,
      message: `The file extension is not allowed for ${kind} uploads.`,
    };
  }
  if (!rules.mimeTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      message: `The file type is not allowed for ${kind} uploads.`,
    };
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return {
      valid: false,
      message: "Files must be larger than 0 bytes and no larger than 50 MB.",
    };
  }

  return { valid: true, extension };
}

function extensionOf(name: string): string {
  const match = /\.[a-z0-9]+$/i.exec(name.trim());
  return match?.[0].toLowerCase() ?? "";
}
