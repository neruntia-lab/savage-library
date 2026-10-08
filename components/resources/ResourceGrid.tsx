import type { ResourceSummary } from "../../lib/domain/resource";
import { EmptyState } from "../ui/EmptyState";
import { ResourceCard } from "./ResourceCard";

export function ResourceGrid({ resources }: { resources: ResourceSummary[] }) {
  if (!resources.length) {
    return (
      <EmptyState
        title="No resources found"
        description="Try removing a filter or using a broader search."
      />
    );
  }

  return (
    <div className="resource-grid">
      {resources.map((resource) => (
        <ResourceCard key={resource.id} resource={resource} />
      ))}
    </div>
  );
}
