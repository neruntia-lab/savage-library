import { del } from "@vercel/blob";
import { privateBlobToken } from "../config/blob";
import {
  deleteResource,
  getResourceStorageKeys,
} from "../repositories/resource-repository";

export async function deleteResourceAndFiles(id: string): Promise<boolean> {
  const storageUrls = await getResourceStorageKeys(id);
  const deleted = await deleteResource(id);
  if (!deleted) return false;

  await Promise.all(
    storageUrls.map(async (url) => {
      const isPublic = url.includes(".public.blob.vercel-storage.com");
      const token = isPublic
        ? process.env.PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN
        : privateBlobToken();
      if (token) await del(url, { token }).catch(() => undefined);
    }),
  );
  return true;
}
