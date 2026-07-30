export function privateBlobToken(): string | undefined {
  return (
    process.env.PRIVATE_CONTENT_BLOB_READ_WRITE_TOKEN ??
    process.env.BLOB_READ_WRITE_TOKEN
  );
}
