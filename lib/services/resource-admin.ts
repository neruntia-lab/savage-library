import {
  deleteResource,
  getResourceStorageKeys,
} from "../repositories/resource-repository";
import { getFileBucketBinding } from "../platform/bindings";

export async function deleteResourceAndFiles(id: string): Promise<boolean> {
  const storageKeys = await getResourceStorageKeys(id);
  const bucket = getFileBucketBinding();

  if (storageKeys.length && !bucket) {
    throw new Error("File storage is unavailable.");
  }
  if (bucket && storageKeys.length) {
    await bucket.delete(storageKeys);
  }

  return deleteResource(id);
}
