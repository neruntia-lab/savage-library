import type { FileKind } from "../domain/resource";

export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
export const MAX_DESCRIPTION_IMAGE_BYTES = 10 * 1024 * 1024;

const FILE_RULES: Record<
  FileKind,
  { extensions: readonly string[]; mimeTypes: readonly string[]; maxBytes?: number }
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
  macro: {
    extensions: [".js", ".json"],
    mimeTypes: [
      "application/javascript",
      "text/javascript",
      "application/json",
      "text/json",
      "text/plain",
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
  descriptionImage: {
    extensions: [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    mimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
    maxBytes: MAX_DESCRIPTION_IMAGE_BYTES,
  },
  manifest: {
    extensions: [".json"],
    mimeTypes: ["application/json", "text/json"],
  },
};

export function uploadRulesForKind(kind: FileKind) {
  return FILE_RULES[kind];
}

export function maximumUploadBytesForKind(kind: FileKind) {
  return FILE_RULES[kind].maxBytes ?? MAX_UPLOAD_BYTES;
}

export function validateUploadMetadata(input: {
  name: string;
  type: string;
  size: number;
  kind: FileKind;
}): { valid: true; extension: string } | { valid: false; message: string } {
  const rules = FILE_RULES[input.kind];
  const extension = extensionOf(input.name);
  if (!rules.extensions.includes(extension)) {
    return {
      valid: false,
      message: `The file extension is not allowed for ${input.kind} uploads.`,
    };
  }
  if (!rules.mimeTypes.includes(input.type.toLowerCase())) {
    return {
      valid: false,
      message: `The file type is not allowed for ${input.kind} uploads.`,
    };
  }
  const maximumBytes = maximumUploadBytesForKind(input.kind);
  if (input.size <= 0 || input.size > maximumBytes) {
    return {
      valid: false,
      message: `Files must be larger than 0 bytes and no larger than ${Math.round(maximumBytes / 1024 / 1024)} MB.`,
    };
  }
  return { valid: true, extension };
}

export function validateUpload(
  file: File,
  kind: FileKind,
): { valid: true; extension: string } | { valid: false; message: string } {
  return validateUploadMetadata({
    name: file.name,
    type: file.type,
    size: file.size,
    kind,
  });
}

function extensionOf(name: string): string {
  const match = /\.[a-z0-9]+$/i.exec(name.trim());
  return match?.[0].toLowerCase() ?? "";
}
