import Image from "next/image";
import Link from "next/link";
import type { AdminResource } from "./types";

export function AdminResourceList({
  resources,
  onPublicationToggle,
  onDelete,
}: {
  resources: AdminResource[];
  onPublicationToggle: (resource: AdminResource) => Promise<void>;
  onDelete: (resource: AdminResource) => Promise<void>;
}) {
  if (!resources.length) {
    return (
      <section className="admin-panel admin-empty">
        <p className="eyebrow">No matching entries</p>
        <h2>The shelves are clear.</h2>
        <p>Adjust the filters or create a new resource.</p>
      </section>
    );
  }

  return (
    <section className="admin-panel admin-content-panel" aria-label="Library content">
      <div className="admin-table-header" aria-hidden="true">
        <span>Resource</span>
        <span>Release</span>
        <span>Access</span>
        <span>Status</span>
        <span>Actions</span>
      </div>
      <div className="admin-resource-list">
        {resources.map((resource) => (
          <article key={resource.id}>
            <div className="admin-resource-identity">
              <div className="admin-resource-thumb">
                <Image
                  src={resource.thumbnailUrl ?? "/savage-library-logo.svg"}
                  alt=""
                  width={48}
                  height={58}
                />
              </div>
              <div>
                <span>{resource.resourceType}</span>
                <h3>{resource.title}</h3>
                <small>/{resource.slug}</small>
              </div>
            </div>
            <div>
              <strong>v{resource.currentVersion}</strong>
              <small>
                {new Date(resource.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </small>
              {resource.pendingReleaseCount > 0 ? (
                <Link
                  className="admin-release-review-link"
                  href={`/admin/resources/${resource.id}#module-releases`}
                >
                  Review {resource.pendingReleaseCount} release{" "}
                  {resource.pendingReleaseCount === 1 ? "draft" : "drafts"}
                </Link>
              ) : null}
            </div>
            <div>
              <span
                className={`admin-status-pill ${
                  resource.accessMode === "patreon" ? "patreon" : ""
                }`}
              >
                {resource.accessMode === "patreon" ? "Patreon" : "Public"}
              </span>
            </div>
            <div>
              <span
                className={`admin-status-pill ${
                  resource.isPublished ? "published" : "draft"
                }`}
              >
                {resource.isPublished ? "Published" : "Draft"}
              </span>
              <small>{resource.downloadCount.toLocaleString()} downloads</small>
            </div>
            <div className="admin-row-actions">
              <Link
                className="button button-secondary button-small"
                href={`/admin/resources/${resource.id}`}
              >
                Edit
              </Link>
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={() => onPublicationToggle(resource)}
              >
                {resource.isPublished ? "Unpublish" : "Publish"}
              </button>
              <button
                className="admin-more-button"
                type="button"
                aria-label={`Delete ${resource.title}`}
                onClick={() => onDelete(resource)}
              >
                ×
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
