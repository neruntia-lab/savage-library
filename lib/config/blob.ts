import { isLocalPreview } from "./local-preview";

export function privateBlobToken(): string | undefined {
  if (isLocalPreview()) return undefined;
  return (
    process.env.PRIVATE_CONTENT_BLOB_READ_WRITE_TOKEN ??
    process.env.BLOB_READ_WRITE_TOKEN
  );
}

export function publicMediaBlobToken(): string | undefined {
  if (isLocalPreview()) return undefined;
  return process.env.PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN;
}
