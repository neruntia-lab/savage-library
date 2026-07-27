"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CatalogFacets, FileKind } from "../../lib/domain/resource";
import type {
  ResourceInput,
  ResourceTranslationInput,
} from "../../lib/validation/resource";
import type { EditingResource } from "./types";

type PatreonTier = {
  id: string;
  title: string;
  description: string;
  amountCents: number;
  isPublished: boolean;
};

export function ResourceWorkspace({
  initialValue,
  facets,
  tiers,
}: {
  initialValue: ResourceInput | EditingResource;
  facets: CatalogFacets;
  tiers: PatreonTier[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const savingRef = useRef(false);
  const editing = "id" in initialValue;
  const resourceId = editing ? initialValue.id : null;
  const resourceVersionId = editing ? initialValue.resourceVersionId : null;
  const [locale, setLocale] = useState<"en" | "es">("en");
  const [accessMode, setAccessMode] = useState<"public" | "patreon">(
    initialValue.accessMode,
  );
  const [dependencies, setDependencies] = useState(initialValue.dependencies);
  const [status, setStatus] = useState(
    editing ? "All changes saved." : "Start with a title. You can save a draft at any time.",
  );
  const [changeVersion, setChangeVersion] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {},
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing || changeVersion === 0) return;
    const timer = window.setTimeout(() => {
      void saveResource({ autosave: true });
    }, 1800);
    return () => window.clearTimeout(timer);
    // The counter deliberately snapshots the latest uncontrolled form values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeVersion]);

  function changed() {
    setStatus("Unsaved changes");
    setChangeVersion((value) => value + 1);
  }

  async function saveResource(options?: {
    autosave?: boolean;
    publish?: boolean;
  }) {
    if (!formRef.current || savingRef.current) return;
    savingRef.current = true;
    setBusy(true);
    setStatus(options?.autosave ? "Autosaving…" : options?.publish ? "Publishing…" : "Saving…");

    const payload = buildPayload(
      new FormData(formRef.current),
      dependencies,
      accessMode,
      options?.publish ?? initialValue.isPublished,
    );
    if (options?.autosave) {
      payload.changelogSummary = "";
      payload.changelogDetails = "";
    }
    const response = await fetch(
      resourceId ? `/api/resources/${resourceId}` : "/api/resources",
      {
        method: resourceId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const body = (await response.json().catch(() => ({}))) as {
      id?: string;
      error?: string;
      errors?: Record<string, string>;
    };

    savingRef.current = false;
    setBusy(false);
    if (!response.ok) {
      setStatus(
        body.error ??
          Object.values(body.errors ?? {})[0] ??
          "The resource could not be saved.",
      );
      return;
    }

    setStatus(options?.publish ? "Published successfully." : "All changes saved.");
    if (!resourceId && body.id) {
      router.replace(`/admin/resources/${body.id}`);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  async function uploadFile(kind: FileKind, file: File) {
    if (!resourceVersionId) {
      setStatus("Save this draft before uploading files.");
      return;
    }
    const key = `${locale}-${kind}`;
    const mimeType = normalizedMimeType(file);
    setUploadProgress((current) => ({ ...current, [key]: 1 }));
    setStatus(`Uploading ${file.name}…`);
    try {
      const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .slice(0, 120);
      await upload(
        `resource-files/${resourceVersionId}/${Date.now()}-${safeName}`,
        file,
        {
          access:
            kind === "cover" || kind === "thumbnail" ? "public" : "private",
          handleUploadUrl: "/api/uploads",
          multipart: file.size > 20 * 1024 * 1024,
          clientPayload: JSON.stringify({
            resourceVersionId,
            kind,
            locale,
            originalName: file.name,
            mimeType,
            sizeBytes: file.size,
            uploadedBy: "shared-admin",
          }),
          onUploadProgress(event) {
            setUploadProgress((current) => ({
              ...current,
              [key]: Math.max(1, Math.round(event.percentage)),
            }));
          },
        },
      );
      setUploadProgress((current) => ({ ...current, [key]: 100 }));
      setStatus(`${file.name} uploaded.`);
      router.refresh();
    } catch (error) {
      setUploadProgress((current) => ({ ...current, [key]: 0 }));
      setStatus(
        error instanceof Error ? error.message : "The upload could not complete.",
      );
    }
  }

  return (
    <div className="admin-workspace">
      <aside className="admin-editor-nav">
        <Link href="/admin" className="admin-back-link">
          ← Content library
        </Link>
        <p className="eyebrow">{editing ? "Editing entry" : "New entry"}</p>
        <h1>{initialValue.title || "Untitled resource"}</h1>
        <nav aria-label="Editor sections">
          <a href="#basics">Basics</a>
          <a href="#translations">Translations</a>
          <a href="#classification">Classification</a>
          <a href="#release">Current release</a>
          <a href="#files">Files and artwork</a>
          <a href="#access">Access and publishing</a>
        </nav>
        <div className="admin-save-state" aria-live="polite">
          <span className={status === "All changes saved." ? "saved" : ""} />
          {status}
        </div>
      </aside>

      <form
        ref={formRef}
        className="admin-workspace-form"
        onChange={changed}
        onSubmit={(event) => {
          event.preventDefault();
          void saveResource();
        }}
      >
        <section className="admin-editor-section" id="basics">
          <SectionHeading
            eyebrow="Identity"
            title="Resource basics"
            description="The stable information used to organize and locate this entry."
          />
          <div className="form-grid form-grid-two">
            <Field
              label="Internal title"
              name="title"
              value={initialValue.title}
              required
              onChange={(event) => {
                if (editing) return;
                const slugInput = formRef.current?.elements.namedItem(
                  "slug",
                ) as HTMLInputElement | null;
                if (
                  slugInput &&
                  (!slugInput.value || slugInput.dataset.generated === "true")
                ) {
                  slugInput.value = slugify(event.target.value);
                  slugInput.dataset.generated = "true";
                }
              }}
            />
            <Field
              label="URL slug"
              name="slug"
              value={initialValue.slug}
              required
              hint="Lowercase letters, numbers, and hyphens."
              onChange={(event) => {
                event.currentTarget.dataset.generated = "false";
              }}
            />
          </div>
          <div className="form-grid form-grid-three">
            <SelectField
              label="Resource type"
              name="resourceType"
              value={initialValue.resourceType}
              options={[
                ["module", "Foundry module"],
                ["pdf", "PDF"],
                ["class", "Class"],
                ["subclass", "Subclass"],
              ]}
            />
            <SelectField
              label="Default language"
              name="defaultLocale"
              value={initialValue.defaultLocale}
              options={[
                ["en", "English"],
                ["es", "Spanish"],
              ]}
            />
            <SelectField
              label="Pricing"
              name="pricing"
              value={initialValue.pricing}
              options={[
                ["free", "Free"],
                ["premium", "Premium"],
              ]}
            />
          </div>
        </section>

        <section className="admin-editor-section" id="translations">
          <SectionHeading
            eyebrow="Bilingual catalog"
            title="Public content"
            description="English and Spanish publish independently. Missing translations fall back to the default language."
          />
          <div className="translation-tabs" role="tablist">
            {(["en", "es"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={locale === item}
                className={locale === item ? "active" : ""}
                onClick={() => setLocale(item)}
              >
                {item === "en" ? "English" : "Español"}
                <span>
                  {initialValue.translations[item].isPublished
                    ? "Published"
                    : "Draft"}
                </span>
              </button>
            ))}
          </div>
          {(["en", "es"] as const).map((item) => (
            <div key={item} hidden={locale !== item}>
              <TranslationFields
                locale={item}
                value={initialValue.translations[item]}
              />
            </div>
          ))}
        </section>

        <section className="admin-editor-section" id="classification">
          <SectionHeading
            eyebrow="Discovery"
            title="Classification"
            description="These fields power search, filters, and related-resource suggestions."
          />
          <div className="form-grid form-grid-three">
            <SelectField
              label="Category"
              name="categoryId"
              value={initialValue.categoryId}
              options={facets.categories.map((item) => [item.id, item.name])}
            />
            <SelectField
              label="Game system"
              name="gameSystemId"
              value={initialValue.gameSystemId}
              options={facets.gameSystems.map((item) => [item.id, item.name])}
            />
            <SelectField
              label="Author"
              name="authorId"
              value={initialValue.authorId}
              options={facets.authors.map((item) => [item.id, item.name])}
            />
          </div>
          <div className="form-grid form-grid-two">
            <Field
              label="Class"
              name="className"
              value={initialValue.className ?? ""}
            />
            <Field
              label="Subclass"
              name="subclassName"
              value={initialValue.subclassName ?? ""}
            />
          </div>
          <fieldset className="chip-fieldset">
            <legend>Tags</legend>
            <div className="admin-chip-grid">
              {facets.tags.map((tag) => (
                <label key={tag.id}>
                  <input
                    type="checkbox"
                    name="tagIds"
                    value={tag.id}
                    defaultChecked={initialValue.tagIds.includes(tag.id)}
                  />
                  <span>{tag.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="admin-editor-section" id="release">
          <SectionHeading
            eyebrow="Version history"
            title="Current release"
            description="Changing the version creates a new release while preserving the previous one."
          />
          <div className="form-grid form-grid-four">
            <Field
              label="Resource version"
              name="currentVersion"
              value={initialValue.currentVersion}
              required
            />
            <Field
              label="Foundry minimum"
              name="foundryMinimum"
              value={initialValue.foundryMinimum ?? ""}
            />
            <Field
              label="Foundry verified"
              name="foundryVerified"
              value={initialValue.foundryVerified ?? ""}
            />
            <Field
              label="Foundry maximum"
              name="foundryMaximum"
              value={initialValue.foundryMaximum ?? ""}
            />
          </div>
          {editing && initialValue.releases.length ? (
            <div className="release-history-strip">
              <span>Release history</span>
              <div>
                {initialValue.releases.map((release) => (
                  <span
                    className={release.isCurrent ? "current" : ""}
                    key={release.id}
                    title={new Date(release.releasedAt).toLocaleDateString()}
                  >
                    v{release.version}
                    {release.isCurrent ? " · current" : ""}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="form-grid form-grid-two">
            <SelectField
              label="Compatibility"
              name="compatibilityStatus"
              value={initialValue.compatibilityStatus}
              options={[
                ["verified", "Verified"],
                ["compatible", "Compatible"],
                ["untested", "Untested"],
                ["outdated", "Outdated"],
                ["unsupported", "Unsupported"],
              ]}
            />
            <Field
              label="Project URL"
              name="projectUrl"
              value={initialValue.projectUrl ?? ""}
              type="url"
            />
          </div>
          <div className="form-grid form-grid-two">
            <Field
              label="Changelog summary"
              name="changelogSummary"
              value=""
              placeholder="What changed in this release?"
            />
            <TextArea
              label="Changelog details"
              name="changelogDetails"
              value=""
              compact
            />
          </div>
          <DependenciesEditor
            dependencies={dependencies}
            onChange={(next) => {
              setDependencies(next);
              changed();
            }}
          />
        </section>

        <section className="admin-editor-section" id="files">
          <SectionHeading
            eyebrow={`${locale === "en" ? "English" : "Spanish"} assets`}
            title="Files and artwork"
            description="Uploads are attached to the current release and selected language."
          />
          {!editing ? (
            <div className="admin-callout">
              Save the draft once to enable its secure upload areas.
            </div>
          ) : null}
          <div className="upload-card-grid">
            {(
              [
                ["cover", "Cover image", "PNG, JPG or WebP"],
                ["thumbnail", "Card thumbnail", "PNG, JPG or WebP"],
                ["module", "Foundry module", "ZIP, up to 250 MB"],
                ["pdf", "PDF document", "PDF, up to 250 MB"],
                ["manifest", "Manifest", "JSON"],
              ] as const
            ).map(([kind, title, hint]) => {
              const key = `${locale}-${kind}`;
              const progress = uploadProgress[key] ?? 0;
              const existingFile =
                editing
                  ? initialValue.files.find(
                      (file) => file.kind === kind && file.locale === locale,
                    )
                  : null;
              return (
                <label className="upload-card" key={kind}>
                  <span>{title}</span>
                  <small>
                    {existingFile
                      ? `${existingFile.originalName} · ${formatBytes(existingFile.sizeBytes)}`
                      : hint}
                  </small>
                  <input
                    type="file"
                    disabled={!editing}
                    accept={acceptForKind(kind)}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) void uploadFile(kind, file);
                    }}
                  />
                  {progress > 0 ? (
                    <span className="upload-progress">
                      <i style={{ width: `${progress}%` }} />
                    </span>
                  ) : null}
                  {existingFile ? (
                    <span className="upload-replace-label">
                      Choose a file to replace
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </section>

        <section className="admin-editor-section" id="access">
          <SectionHeading
            eyebrow="Distribution"
            title="Access and publishing"
            description="Resource details remain public. Patreon protection applies to every downloadable release file."
          />
          <div className="access-choice-grid">
            <label className={accessMode === "public" ? "selected" : ""}>
              <input
                type="radio"
                name="accessMode"
                value="public"
                checked={accessMode === "public"}
                onChange={() => {
                  setAccessMode("public");
                  changed();
                }}
              />
              <strong>Public downloads</strong>
              <span>Anyone can download published files.</span>
            </label>
            <label className={accessMode === "patreon" ? "selected" : ""}>
              <input
                type="radio"
                name="accessMode"
                value="patreon"
                checked={accessMode === "patreon"}
                onChange={() => {
                  setAccessMode("patreon");
                  changed();
                }}
              />
              <strong>Patreon members</strong>
              <span>Only selected entitled tiers can download.</span>
            </label>
          </div>
          {accessMode === "patreon" ? (
            <fieldset className="tier-fieldset">
              <legend>Qualifying Patreon tiers</legend>
              {tiers.length ? (
                <div className="tier-choice-grid">
                  {tiers
                    .filter((tier) => tier.isPublished)
                    .map((tier) => (
                      <label key={tier.id}>
                        <input
                          type="checkbox"
                          name="patreonTierIds"
                          value={tier.id}
                          defaultChecked={initialValue.patreonTierIds.includes(
                            tier.id,
                          )}
                        />
                        <span>
                          <strong>{tier.title}</strong>
                          <small>
                            ${(tier.amountCents / 100).toFixed(2)} / month
                          </small>
                        </span>
                      </label>
                    ))}
                </div>
              ) : (
                <div className="admin-callout">
                  Synchronize Patreon tiers from the dashboard before publishing
                  protected content.
                </div>
              )}
            </fieldset>
          ) : null}
          <div className="form-grid form-grid-two">
            <Field
              label="Manifest URL"
              name="manifestUrl"
              value={initialValue.manifestUrl ?? ""}
              type="url"
            />
            <Field
              label="License"
              name="licenseName"
              value={initialValue.licenseName ?? ""}
            />
          </div>
          <label className="featured-toggle">
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={initialValue.isFeatured}
            />
            <span>
              <strong>Featured resource</strong>
              <small>Highlight this entry on the home page.</small>
            </span>
          </label>
        </section>

        <div className="admin-sticky-actions">
          <span aria-live="polite">{status}</span>
          <div>
            {editing ? (
              <Link
                className="button button-secondary"
                href={`/admin/resources/${resourceId}/preview`}
                target="_blank"
              >
                Preview
              </Link>
            ) : null}
            <button
              className="button button-secondary"
              type="submit"
              disabled={busy}
            >
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={busy}
              onClick={() => void saveResource({ publish: true })}
            >
              Publish
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function TranslationFields({
  locale,
  value,
}: {
  locale: "en" | "es";
  value: ResourceTranslationInput;
}) {
  return (
    <div className="translation-fields">
      <Field
        label={locale === "en" ? "English title" : "Título en español"}
        name={`${locale}Title`}
        value={value.title}
      />
      <Field
        label="Short description"
        name={`${locale}ShortDescription`}
        value={value.shortDescription}
        maxLength={240}
        hint={`${value.shortDescription.length}/240 characters`}
      />
      <TextArea
        label="Full description"
        name={`${locale}Description`}
        value={value.description}
      />
      <div className="form-grid form-grid-two">
        <TextArea
          label="Compatibility notes"
          name={`${locale}CompatibilityNotes`}
          value={value.compatibilityNotes ?? ""}
          compact
        />
        <TextArea
          label="Installation instructions"
          name={`${locale}InstallationInstructions`}
          value={value.installationInstructions ?? ""}
          compact
        />
      </div>
      <label className="translation-publish-toggle">
        <input
          type="checkbox"
          name={`${locale}Published`}
          defaultChecked={value.isPublished}
        />
        <span>Publish this translation when the resource is published</span>
      </label>
    </div>
  );
}

function DependenciesEditor({
  dependencies,
  onChange,
}: {
  dependencies: ResourceInput["dependencies"];
  onChange: (value: ResourceInput["dependencies"]) => void;
}) {
  return (
    <fieldset className="dependencies-editor">
      <div className="fieldset-heading">
        <div>
          <legend>Dependencies</legend>
          <small>Modules or packages visitors need before installation.</small>
        </div>
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={() =>
            onChange([
              ...dependencies,
              { name: "", versionRange: "", url: "", isRequired: true },
            ])
          }
        >
          + Add dependency
        </button>
      </div>
      {dependencies.map((dependency, index) => (
        <div className="dependency-row" key={index}>
          <input
            aria-label={`Dependency ${index + 1} name`}
            placeholder="Module name"
            value={dependency.name}
            onChange={(event) =>
              onChange(
                dependencies.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, name: event.target.value }
                    : item,
                ),
              )
            }
          />
          <input
            aria-label={`Dependency ${index + 1} version`}
            placeholder="Version range"
            value={dependency.versionRange ?? ""}
            onChange={(event) =>
              onChange(
                dependencies.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, versionRange: event.target.value }
                    : item,
                ),
              )
            }
          />
          <input
            aria-label={`Dependency ${index + 1} URL`}
            placeholder="https://…"
            value={dependency.url ?? ""}
            onChange={(event) =>
              onChange(
                dependencies.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, url: event.target.value }
                    : item,
                ),
              )
            }
          />
          <label>
            <input
              type="checkbox"
              checked={dependency.isRequired}
              onChange={(event) =>
                onChange(
                  dependencies.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, isRequired: event.target.checked }
                      : item,
                  ),
                )
              }
            />
            Required
          </label>
          <button
            type="button"
            className="admin-more-button"
            aria-label={`Remove dependency ${index + 1}`}
            onClick={() =>
              onChange(dependencies.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            ×
          </button>
        </div>
      ))}
    </fieldset>
  );
}

function buildPayload(
  formData: FormData,
  dependencies: ResourceInput["dependencies"],
  accessMode: "public" | "patreon",
  isPublished: boolean,
) {
  const value = (name: string) => String(formData.get(name) ?? "");
  const translation = (locale: "en" | "es") => ({
    title: value(`${locale}Title`),
    shortDescription: value(`${locale}ShortDescription`),
    description: value(`${locale}Description`),
    compatibilityNotes: value(`${locale}CompatibilityNotes`),
    installationInstructions: value(`${locale}InstallationInstructions`),
    isPublished: formData.get(`${locale}Published`) === "on",
  });
  const translations = { en: translation("en"), es: translation("es") };
  const defaultLocale = value("defaultLocale") === "es" ? "es" : "en";
  const primary =
    translations[defaultLocale].title.trim() ? translations[defaultLocale] : translations.en;

  return {
    title: value("title") || primary.title,
    slug: value("slug"),
    shortDescription: primary.shortDescription,
    description: primary.description,
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
    compatibilityNotes: primary.compatibilityNotes,
    pricing: value("pricing"),
    manifestUrl: value("manifestUrl"),
    projectUrl: value("projectUrl"),
    licenseName: value("licenseName"),
    installationInstructions: primary.installationInstructions,
    tagIds: formData.getAll("tagIds"),
    dependencies,
    changelogSummary: value("changelogSummary"),
    changelogDetails: value("changelogDetails"),
    defaultLocale,
    accessMode,
    patreonTierIds: formData.getAll("patreonTierIds"),
    translations,
    isFeatured: formData.get("isFeatured") === "on",
    isPublished,
  };
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="admin-section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  type = "text",
  hint,
  ...props
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
  hint?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} type={type} defaultValue={value} {...props} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function TextArea({
  label,
  name,
  value,
  compact = false,
}: {
  label: string;
  name: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <label>
      <span>{label}</span>
      <textarea
        name={name}
        defaultValue={value}
        className={compact ? "textarea-compact" : ""}
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
  options: Array<readonly [string, string]>;
}) {
  return (
    <label>
      <span>{label}</span>
      <select name={name} defaultValue={value} required>
        <option value="" disabled>
          Select…
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

function normalizedMimeType(file: File): string {
  if (file.type) return file.type;
  if (file.name.toLowerCase().endsWith(".zip")) return "application/zip";
  if (file.name.toLowerCase().endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

function acceptForKind(kind: FileKind): string {
  switch (kind) {
    case "cover":
    case "thumbnail":
      return ".png,.jpg,.jpeg,.webp";
    case "module":
      return ".zip";
    case "pdf":
      return ".pdf";
    case "manifest":
      return ".json";
  }
}

function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_024 * 1_024) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / (1_024 * 1_024)).toFixed(1)} MB`;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
