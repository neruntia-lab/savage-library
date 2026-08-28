import { CANONICAL_SITE_ORIGIN } from "../config/site";
import { listModuleReleases, publishRelease } from "../repositories/publisher-repository";
import {
  getAdminResource,
  hasCurrentResourceFile,
  setResourcePublication,
} from "../repositories/resource-repository";
import { wizardContentChecks } from "./resource-wizard";

export async function getResourcePublicationChecks(resourceId: string) {
  const resource = await getAdminResource(resourceId);
  if (!resource) return null;
  const releases = resource.resourceType === "module" ? await listModuleReleases(resource.id) : [];
  const hasValidatedModuleRelease = releases.some(isValidatedRelease);
  const hasPrimaryFile =
    resource.resourceType === "pdf" || resource.resourceType === "macro"
      ? await hasCurrentResourceFile(resource.id, resource.resourceType)
      : false;
  return {
    resource,
    releases,
    capabilities: { hasPrimaryFile, hasValidatedModuleRelease },
    checks: wizardContentChecks(resource, { hasPrimaryFile, hasValidatedModuleRelease }),
  };
}

export async function publishResourceWithDelivery(resourceId: string) {
  const readiness = await getResourcePublicationChecks(resourceId);
  if (!readiness) throw new Error("Resource not found.");
  const required = readiness.checks.filter((check) => check.level === "required");
  if (required.length) {
    const error = new Error("Resolve the required delivery and content items before publishing.");
    Object.assign(error, { checks: readiness.checks });
    throw error;
  }
  if (readiness.resource.resourceType === "module") {
    const release = readiness.releases.find(isValidatedDraftRelease);
    if (release) {
      await publishRelease(resourceId, release.id, CANONICAL_SITE_ORIGIN, { publishCatalog: true });
    } else if (readiness.releases.some((item) => item.status === "published" && isValidatedRelease(item))) {
      await setResourcePublication(resourceId, true);
    } else {
      throw new Error("A validated module release is required.");
    }
    return;
  }
  await setResourcePublication(resourceId, true);
}

function isValidatedDraftRelease(release: {
  status: string;
  checksum: string | null;
  size: number | null;
  errors: string;
}) {
  return release.status === "draft" && Boolean(release.checksum && release.size) && noReleaseErrors(release.errors);
}

function isValidatedRelease(release: {
  status: string;
  checksum: string | null;
  size: number | null;
  errors: string;
}) {
  return ["draft", "published"].includes(release.status) && Boolean(release.checksum && release.size) && noReleaseErrors(release.errors);
}

function noReleaseErrors(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.length === 0;
  } catch {
    return false;
  }
}
