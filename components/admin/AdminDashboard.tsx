"use client";

import { useState } from "react";
import type { CatalogFacets } from "../../lib/domain/resource";
import type { ResourceInput } from "../../lib/validation/resource";
import { AdminResourceList } from "./AdminResourceList";
import { ResourceEditor } from "./ResourceEditor";
import { TaxonomyManager } from "./TaxonomyManager";
import {
  EMPTY_RESOURCE,
  type AdminResource,
  type EditingResource,
} from "./types";

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

  const publishedCount = resources.filter(
    (resource) => resource.isPublished,
  ).length;
  const totalDownloads = resources.reduce(
    (total, resource) => total + resource.downloadCount,
    0,
  );

  async function refreshResources() {
    const response = await fetch("/api/resources?admin=1");
    if (!response.ok) return;
    const body = (await response.json()) as { resources: AdminResource[] };
    setResources(body.resources);
  }

  async function submitResource(formData: FormData) {
    setStatus("Saving resource…");
    const dependencies = parseDependencies(formData.get("dependencies"));
    if (!dependencies.ok) {
      setStatus(dependencies.message);
      return;
    }

    const payload = resourcePayload(formData, dependencies.value);
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

  async function deleteResource(resource: AdminResource) {
    if (
      !window.confirm(
        `Delete “${resource.title}” and all of its versions and files?`,
      )
    ) {
      return;
    }
    const response = await fetch(`/api/resources/${resource.id}`, {
      method: "DELETE",
    });
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
    if (response.ok) await refreshResources();
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
        <TabButton
          active={activePanel === "resources"}
          onClick={() => setActivePanel("resources")}
        >
          Resources
        </TabButton>
        <TabButton
          active={activePanel === "metadata"}
          onClick={() => setActivePanel("metadata")}
        >
          Categories and metadata
        </TabButton>
      </div>

      <p className="admin-live-status" aria-live="polite">
        {status}
      </p>

      {activePanel === "resources" ? (
        <div className="admin-layout">
          <AdminResourceList
            resources={resources}
            onEdit={editResource}
            onPublicationToggle={togglePublication}
            onDelete={deleteResource}
            onUpload={uploadFile}
          />
          <ResourceEditor
            key={formKey}
            value={editing ?? EMPTY_RESOURCE}
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

function resourcePayload(
  formData: FormData,
  dependencies: ResourceInput["dependencies"],
) {
  const value = (name: string) => formData.get(name);
  return {
    title: value("title"),
    slug: value("slug"),
    shortDescription: value("shortDescription"),
    description: value("description"),
    resourceType: value("resourceType"),
    categoryId: value("categoryId"),
    authorId: value("authorId"),
    gameSystemId: value("gameSystemId"),
    className: value("className"),
    subclassName: value("subclassName"),
    currentVersion: value("currentVersion"),
    foundryMinimum: value("foundryMinimum"),
    foundryVerified: value("foundryVerified"),
    foundryMaximum: value("foundryMaximum"),
    compatibilityStatus: value("compatibilityStatus"),
    compatibilityNotes: value("compatibilityNotes"),
    pricing: value("pricing"),
    priceLabel: value("priceLabel"),
    manifestUrl: value("manifestUrl"),
    projectUrl: value("projectUrl"),
    licenseName: value("licenseName"),
    installationInstructions: value("installationInstructions"),
    tagIds: formData.getAll("tagIds"),
    dependencies,
    changelogSummary: value("changelogSummary"),
    changelogDetails: value("changelogDetails"),
    isFeatured: value("isFeatured") === "on",
    isPublished: value("isPublished") === "on",
  };
}

function parseDependencies(
  value: FormDataEntryValue | null,
):
  | { ok: true; value: ResourceInput["dependencies"] }
  | { ok: false; message: string } {
  const source = String(value ?? "").trim();
  if (!source) return { ok: true, value: [] };
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed)
      ? { ok: true, value: parsed as ResourceInput["dependencies"] }
      : { ok: false, message: "Dependencies must be a JSON array." };
  } catch {
    return { ok: false, message: "Dependencies must be valid JSON." };
  }
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={active ? "active" : ""}
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
    >
      {children}
    </button>
  );
}
