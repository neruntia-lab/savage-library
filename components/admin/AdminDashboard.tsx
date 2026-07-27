"use client";

import { useState } from "react";
import type { CatalogFacets } from "../../lib/domain/resource";
import type { ResourceInput } from "../../lib/validation/resource";

type AdminResource = {
  id: string;
  slug: string;
  title: string;
  resourceType: string;
  currentVersion: string;
  isPublished: boolean;
  isFeatured: boolean;
  downloadCount: number;
  updatedAt: string;
  resourceVersionId: string;
};

type EditingResource = ResourceInput & { id: string };

const emptyResource: ResourceInput = {
  title: "",
  slug: "",
  shortDescription: "",
  description: "",
  resourceType: "module",
  categoryId: "",
  authorId: "",
  gameSystemId: "",
  currentVersion: "1.0.0",
  compatibilityStatus: "untested",
  pricing: "free",
  tagIds: [],
  dependencies: [],
  isFeatured: false,
  isPublished: false,
};

export function AdminDashboard({
  initialResources,
  facets,
}: {
  initialResources: AdminResource[];
  facets: CatalogFacets;
}) {
  const [resources, setResources] = useState(initialResources);
  const [editing, setEditing] = useState<EditingResource | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [status, setStatus] = useState("");
  const [activePanel, setActivePanel] = useState<"resources" | "metadata">(
    "resources",
  );

  const publishedCount = resources.filter((resource) => resource.isPublished).length;
  const totalDownloads = resources.reduce(
    (total, resource) => total + resource.downloadCount,
    0,
  );

  async function refreshResources() {
    const response = await fetch("/api/resources?admin=1");
    if (response.ok) {
      const body = (await response.json()) as { resources: AdminResource[] };
      setResources(body.resources);
    }
  }

  async function submitResource(formData: FormData) {
    setStatus("Saving resource…");
    let dependencies: ResourceInput["dependencies"] = [];
    const dependencyText = String(formData.get("dependencies") ?? "").trim();
    if (dependencyText) {
      try {
        dependencies = JSON.parse(dependencyText) as ResourceInput["dependencies"];
      } catch {
        setStatus("Dependencies must be valid JSON.");
        return;
      }
    }

    const payload = {
      title: formData.get("title"),
      slug: formData.get("slug"),
      shortDescription: formData.get("shortDescription"),
      description: formData.get("description"),
      resourceType: formData.get("resourceType"),
      categoryId: formData.get("categoryId"),
      authorId: formData.get("authorId"),
      gameSystemId: formData.get("gameSystemId"),
      className: formData.get("className"),
      subclassName: formData.get("subclassName"),
      currentVersion: formData.get("currentVersion"),
      foundryMinimum: formData.get("foundryMinimum"),
      foundryVerified: formData.get("foundryVerified"),
      foundryMaximum: formData.get("foundryMaximum"),
      compatibilityStatus: formData.get("compatibilityStatus"),
      compatibilityNotes: formData.get("compatibilityNotes"),
      pricing: formData.get("pricing"),
      priceLabel: formData.get("priceLabel"),
      manifestUrl: formData.get("manifestUrl"),
      projectUrl: formData.get("projectUrl"),
      licenseName: formData.get("licenseName"),
      installationInstructions: formData.get("installationInstructions"),
      tagIds: formData.getAll("tagIds"),
      dependencies,
      changelogSummary: formData.get("changelogSummary"),
      changelogDetails: formData.get("changelogDetails"),
      isFeatured: formData.get("isFeatured") === "on",
      isPublished: formData.get("isPublished") === "on",
    };

    const response = await fetch(
      editing ? `/api/resources/${editing.id}` : "/api/resources",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const body = (await response.json()) as {
      error?: string;
      errors?: Record<string, string>;
    };
    if (!response.ok) {
      setStatus(
        body.error ??
          Object.values(body.errors ?? {})[0] ??
          "The resource could not be saved.",
      );
      return;
    }

    setStatus(editing ? "Resource updated." : "Resource created.");
    setEditing(null);
    setFormKey((value) => value + 1);
    await refreshResources();
  }

  async function editResource(id: string) {
    setStatus("Loading resource…");
    const response = await fetch(`/api/resources/${id}`);
    if (!response.ok) {
      setStatus("The resource could not be loaded.");
      return;
    }
    const body = (await response.json()) as { resource: EditingResource };
    setEditing(body.resource);
    setFormKey((value) => value + 1);
    setStatus(`Editing ${body.resource.title}.`);
    document.getElementById("resource-editor")?.scrollIntoView();
  }

  async function togglePublication(resource: AdminResource) {
    const response = await fetch(`/api/resources/${resource.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !resource.isPublished }),
    });
    setStatus(
      response.ok
        ? resource.isPublished
          ? "Resource unpublished."
          : "Resource published."
        : "Publication status could not be changed.",
    );
    if (response.ok) await refreshResources();
  }

  async function deleteResource(id: string, title: string) {
    if (!window.confirm(`Delete “${title}” and all of its versions and files?`)) {
      return;
    }
    const response = await fetch(`/api/resources/${id}`, { method: "DELETE" });
    setStatus(
      response.ok ? "Resource deleted." : "The resource could not be deleted.",
    );
    if (response.ok) await refreshResources();
  }

  async function uploadFile(formData: FormData) {
    setStatus("Uploading file…");
    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });
    const body = (await response.json()) as { error?: string };
    setStatus(response.ok ? "File uploaded." : body.error ?? "Upload failed.");
  }

  return (
    <>
      <div className="admin-stats" aria-label="Library statistics">
        <Stat label="Resources" value={resources.length} />
        <Stat label="Published" value={publishedCount} />
        <Stat label="Downloads" value={totalDownloads.toLocaleString()} />
        <Stat
          label="Drafts"
          value={Math.max(0, resources.length - publishedCount)}
        />
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        <button
          className={activePanel === "resources" ? "active" : ""}
          type="button"
          onClick={() => setActivePanel("resources")}
          role="tab"
          aria-selected={activePanel === "resources"}
        >
          Resources
        </button>
        <button
          className={activePanel === "metadata" ? "active" : ""}
          type="button"
          onClick={() => setActivePanel("metadata")}
          role="tab"
          aria-selected={activePanel === "metadata"}
        >
          Categories and metadata
        </button>
      </div>

      <p className="admin-live-status" aria-live="polite">
        {status}
      </p>

      {activePanel === "resources" ? (
        <div className="admin-layout">
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
                      onClick={() => editResource(resource.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="button button-secondary button-small"
                      type="button"
                      onClick={() => togglePublication(resource)}
                    >
                      {resource.isPublished ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      className="button button-danger button-small"
                      type="button"
                      onClick={() =>
                        deleteResource(resource.id, resource.title)
                      }
                    >
                      Delete
                    </button>
                  </div>
                  <form className="upload-row" action={uploadFile}>
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

          <ResourceEditor
            key={formKey}
            value={editing ?? emptyResource}
            editing={Boolean(editing)}
            facets={facets}
            onSubmit={submitResource}
            onCancel={() => {
              setEditing(null);
              setFormKey((value) => value + 1);
              setStatus("Editor cleared.");
            }}
          />
        </div>
      ) : (
        <TaxonomyManager facets={facets} onStatus={setStatus} />
      )}
    </>
  );
}

function ResourceEditor({
  value,
  editing,
  facets,
  onSubmit,
  onCancel,
}: {
  value: ResourceInput;
  editing: boolean;
  facets: CatalogFacets;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <section
      className="admin-panel admin-editor"
      id="resource-editor"
      aria-labelledby="editor-title"
    >
      <div className="admin-panel-heading">
        <h2 id="editor-title">{editing ? "Edit resource" : "New resource"}</h2>
      </div>
      <form className="admin-form" action={onSubmit}>
        <div className="form-grid form-grid-two">
          <Field label="Title" name="title" value={value.title} required />
          <Field label="Slug" name="slug" value={value.slug} required />
        </div>
        <Field
          label="Short description"
          name="shortDescription"
          value={value.shortDescription}
          required
          maxLength={240}
        />
        <TextArea label="Description" name="description" value={value.description} />
        <div className="form-grid form-grid-three">
          <SelectField
            label="Type"
            name="resourceType"
            value={value.resourceType}
            options={[
              ["module", "Module"],
              ["class", "Class"],
              ["subclass", "Subclass"],
              ["pdf", "PDF"],
            ]}
          />
          <SelectField
            label="Category"
            name="categoryId"
            value={value.categoryId}
            options={facets.categories.map((item) => [item.id, item.name])}
          />
          <SelectField
            label="Game system"
            name="gameSystemId"
            value={value.gameSystemId}
            options={facets.gameSystems.map((item) => [item.id, item.name])}
          />
        </div>
        <div className="form-grid form-grid-three">
          <SelectField
            label="Author"
            name="authorId"
            value={value.authorId}
            options={facets.authors.map((item) => [item.id, item.name])}
          />
          <Field label="Class" name="className" value={value.className ?? ""} />
          <Field
            label="Subclass"
            name="subclassName"
            value={value.subclassName ?? ""}
          />
        </div>
        <div className="form-grid form-grid-four">
          <Field
            label="Resource version"
            name="currentVersion"
            value={value.currentVersion}
            required
          />
          <Field
            label="Foundry minimum"
            name="foundryMinimum"
            value={value.foundryMinimum ?? ""}
          />
          <Field
            label="Foundry verified"
            name="foundryVerified"
            value={value.foundryVerified ?? ""}
          />
          <Field
            label="Foundry maximum"
            name="foundryMaximum"
            value={value.foundryMaximum ?? ""}
          />
        </div>
        <div className="form-grid form-grid-two">
          <SelectField
            label="Compatibility"
            name="compatibilityStatus"
            value={value.compatibilityStatus}
            options={[
              ["verified", "Verified"],
              ["compatible", "Compatible"],
              ["untested", "Untested"],
              ["outdated", "Outdated"],
              ["unsupported", "Unsupported"],
            ]}
          />
          <TextArea
            label="Compatibility notes"
            name="compatibilityNotes"
            value={value.compatibilityNotes ?? ""}
            compact
          />
        </div>
        <div className="form-grid form-grid-two">
          <SelectField
            label="Pricing"
            name="pricing"
            value={value.pricing}
            options={[
              ["free", "Free"],
              ["premium", "Premium"],
            ]}
          />
          <Field
            label="Price label"
            name="priceLabel"
            value={value.priceLabel ?? ""}
            placeholder="$5 or Marketplace"
          />
        </div>
        <div className="form-grid form-grid-two">
          <Field
            label="Manifest URL"
            name="manifestUrl"
            value={value.manifestUrl ?? ""}
            type="url"
          />
          <Field
            label="Project URL"
            name="projectUrl"
            value={value.projectUrl ?? ""}
            type="url"
          />
        </div>
        <Field
          label="License"
          name="licenseName"
          value={value.licenseName ?? ""}
        />
        <TextArea
          label="Installation instructions"
          name="installationInstructions"
          value={value.installationInstructions ?? ""}
        />
        <label>
          <span>Tags</span>
          <select
            name="tagIds"
            multiple
            defaultValue={value.tagIds}
            className="multi-select"
          >
            {facets.tags.map((tag) => (
              <option value={tag.id} key={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          <small>Hold Ctrl or Command to select multiple.</small>
        </label>
        <TextArea
          label="Dependencies (JSON array)"
          name="dependencies"
          value={JSON.stringify(value.dependencies, null, 2)}
          placeholder='[{"name":"Required module","versionRange":">=1.0","url":"https://…","isRequired":true}]'
        />
        <div className="form-grid form-grid-two">
          <Field
            label="Changelog summary"
            name="changelogSummary"
            value=""
            placeholder="What changed in this version?"
          />
          <TextArea
            label="Changelog details"
            name="changelogDetails"
            value=""
            compact
          />
        </div>
        <div className="checkbox-row">
          <label>
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={value.isFeatured}
            />
            <span>Featured</span>
          </label>
          <label>
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={value.isPublished}
            />
            <span>Published</span>
          </label>
        </div>
        <div className="admin-form-actions">
          <button className="button button-primary" type="submit">
            {editing ? "Save changes" : "Create resource"}
          </button>
          {editing ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function TaxonomyManager({
  facets,
  onStatus,
}: {
  facets: CatalogFacets;
  onStatus: (message: string) => void;
}) {
  const groups = [
    ["author", "Authors", facets.authors],
    ["category", "Categories", facets.categories],
    ["system", "Game systems", facets.gameSystems],
    ["tag", "Tags", facets.tags],
  ] as const;

  async function create(formData: FormData) {
    const response = await fetch("/api/taxonomy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    onStatus(
      response.ok
        ? "Metadata entry created. Reload the page to use it."
        : "Metadata entry could not be created.",
    );
  }

  async function update(
    type: string,
    id: string,
    formData: FormData,
  ) {
    const response = await fetch(`/api/taxonomy/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...Object.fromEntries(formData) }),
    });
    onStatus(response.ok ? "Metadata updated." : "Metadata update failed.");
  }

  async function remove(type: string, id: string) {
    const response = await fetch(
      `/api/taxonomy/${id}?type=${encodeURIComponent(type)}`,
      { method: "DELETE" },
    );
    onStatus(
      response.ok
        ? "Metadata deleted. Reload to refresh the list."
        : "Metadata is still in use or could not be deleted.",
    );
  }

  return (
    <div className="taxonomy-grid">
      {groups.map(([type, title, items]) => (
        <section className="admin-panel" key={type}>
          <div className="admin-panel-heading">
            <h2>{title}</h2>
            <span>{items.length}</span>
          </div>
          <form className="taxonomy-create" action={create}>
            <input type="hidden" name="type" value={type} />
            <input name="name" placeholder={`New ${type} name`} required />
            <input name="slug" placeholder="url-slug" required />
            <button className="button button-primary button-small">Add</button>
          </form>
          <div className="taxonomy-list">
            {items.map((item) => (
              <form
                key={item.id}
                action={(formData) => update(type, item.id, formData)}
              >
                <input name="name" defaultValue={item.name} required />
                <input name="slug" defaultValue={item.slug} required />
                <button className="button button-secondary button-small">
                  Update
                </button>
                <button
                  className="button button-danger button-small"
                  type="button"
                  onClick={() => remove(type, item.id)}
                >
                  Delete
                </button>
              </form>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  type = "text",
  ...props
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} type={type} defaultValue={value} {...props} />
    </label>
  );
}

function TextArea({
  label,
  name,
  value,
  compact = false,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  compact?: boolean;
  placeholder?: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <textarea
        name={name}
        defaultValue={value}
        className={compact ? "textarea-compact" : ""}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <label>
      <span>{label}</span>
      <select name={name} defaultValue={value} required>
        <option value="" disabled>
          Choose…
        </option>
        {options.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
