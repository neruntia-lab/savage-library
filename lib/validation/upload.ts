import type { FileKind } from "../domain/resource";

export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

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
  manifest: {
    extensions: [".json"],
    mimeTypes: ["application/json", "text/json"],
  },
};

export function uploadRulesForKind(kind: FileKind) {
  return FILE_RULES[kind];
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
  if (input.size <= 0 || input.size > MAX_UPLOAD_BYTES) {
    return {
      valid: false,
      message: "Files must be larger than 0 bytes and no larger than 250 MB.",
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
