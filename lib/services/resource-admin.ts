import { env } from "cloudflare:workers";
import {
  deleteResource,
  getResourceStorageKeys,
} from "../repositories/resource-repository";

export async function deleteResourceAndFiles(id: string): Promise<boolean> {
  const storageKeys = await getResourceStorageKeys(id);
  const bucket = env.FILES as R2Bucket | undefined;

  if (storageKeys.length && !bucket) {
    throw new Error("File storage is unavailable.");
  }
  if (bucket && storageKeys.length) {
    await bucket.delete(storageKeys);
  }

  return deleteResource(id);
}
