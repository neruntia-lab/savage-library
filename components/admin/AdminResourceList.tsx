import type { AdminResource } from "./types";

export function AdminResourceList({
  resources,
  onEdit,
  onPublicationToggle,
  onDelete,
  onUpload,
}: {
  resources: AdminResource[];
  onEdit: (id: string) => Promise<void>;
  onPublicationToggle: (resource: AdminResource) => Promise<void>;
  onDelete: (resource: AdminResource) => Promise<void>;
  onUpload: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className="admin-panel" aria-labelledby="resource-list-title">
      <div className="admin-panel-heading">
        <h2 id="resource-list-title">Library content</h2>
        <span>{resources.length} records</span>
      </div>
      <div className="admin-resource-list">
        {resources.map((resource) => (
          <article key={resource.id}>
            <div>
              <span>
                {resource.resourceType} · v{resource.currentVersion}
              </span>
              <h3>{resource.title}</h3>
              <small>
                {resource.downloadCount.toLocaleString()} downloads ·{" "}
                {resource.isPublished ? "Published" : "Draft"}
              </small>
            </div>
            <div className="admin-row-actions">
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={() => onEdit(resource.id)}
              >
                Edit
              </button>
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={() => onPublicationToggle(resource)}
              >
                {resource.isPublished ? "Unpublish" : "Publish"}
              </button>
              <button
                className="button button-danger button-small"
                type="button"
                onClick={() => onDelete(resource)}
              >
                Delete
              </button>
            </div>
            <form className="upload-row" action={onUpload}>
              <input
                type="hidden"
                name="resourceVersionId"
                value={resource.resourceVersionId}
              />
              <label>
                <span className="sr-only">File kind</span>
                <select name="kind" defaultValue="module">
                  <option value="module">Module ZIP</option>
                  <option value="pdf">PDF</option>
                  <option value="cover">Cover</option>
                  <option value="thumbnail">Thumbnail</option>
                  <option value="manifest">Manifest</option>
                </select>
              </label>
              <input
                type="file"
                name="file"
                aria-label={`Upload file for ${resource.title}`}
                required
              />
              <button className="button button-secondary button-small">
                Upload
              </button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
