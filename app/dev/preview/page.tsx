import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocalPreview } from "../../../lib/config/local-preview";
import { previewResource } from "../../../lib/data/preview-resource";
import { SEED_FACETS, SEED_RESOURCES } from "../../../lib/data/seed-resources";
import { ResourceCreationWizard } from "../../../components/admin/ResourceCreationWizard";
import { wizardContentChecks } from "../../../lib/services/resource-wizard";
import { RESOURCE_TYPES } from "../../../lib/domain/resource";
import { PreviewBoundaryState } from "../../../components/dev/PreviewBoundaryState";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Local wizard preview",
  robots: { index: false, follow: false },
};

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; type?: string; screen?: string }>;
}) {
  if (!isLocalPreview()) notFound();
  const query = await searchParams;
  if (query.screen === "error" || query.screen === "loading")
    return <PreviewBoundaryState screen={query.screen} />;
  const step = Math.max(1, Math.min(6, Number(query.step) || 1));
  const resource = previewResource(
    SEED_RESOURCES.find((item) => item.resourceType === query.type)?.id ??
      SEED_RESOURCES[0].id,
  );
  if (!resource) notFound();
  const resourceType = RESOURCE_TYPES.find((type) => type === query.type);
  if (resourceType) resource.resourceType = resourceType;
  resource.setupStep = step;
  resource.setupStatus = "in_progress";
  return (
    <>
      <div className="container local-preview-banner">
        <strong>Local design preview · sample data</strong>
        <span>
          Saving, uploading, and publishing require a separate development
          database.
        </span>
        <nav aria-label="Preview wizard steps">
          {[1, 2, 3, 4, 5, 6].map((value) => (
            <Link
              key={value}
              href={`/dev/preview?step=${value}&type=${query.type ?? "module"}`}
            >
              Step {value}
            </Link>
          ))}
        </nav>
      </div>
      <ResourceCreationWizard
        key={`${resource.id}-${step}`}
        initialValue={resource}
        facets={SEED_FACETS}
        tiers={[]}
        initialChecks={wizardContentChecks(resource, {
          hasPrimaryFile: false,
          hasValidatedModuleRelease: false,
        })}
      />
    </>
  );
}
