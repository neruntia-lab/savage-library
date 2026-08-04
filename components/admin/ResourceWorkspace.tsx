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
import { ModuleReleaseManager } from "./ModuleReleaseManager";

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

  async function uploadFile(
    kind: FileKind,
    file: File,
    targetLocale: "en" | "es" = locale,
  ): Promise<string | undefined> {
    if (!resourceVersionId) {
      setStatus("Save this draft before uploading files.");
      return undefined;
    }
    const uploadLocale = kind === "cover" || kind === "thumbnail" ? "en" : targetLocale;
    const key = `${uploadLocale}-${kind}`;
    const mimeType = normalizedMimeType(file);
    setUploadProgress((current) => ({ ...current, [key]: 1 }));
    setStatus(`Uploading ${file.name}…`);
    try {
      const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .slice(0, 120);
      const blob = await upload(
        `resource-files/${resourceVersionId}/${Date.now()}-${safeName}`,
        file,
        {
          access:
            kind === "cover" ||
            kind === "thumbnail" ||
            kind === "descriptionImage"
              ? "public"
              : "private",
          handleUploadUrl: "/api/uploads",
          multipart: file.size > 20 * 1024 * 1024,
          clientPayload: JSON.stringify({
            resourceVersionId,
            kind,
            locale: uploadLocale,
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
      if (kind === "cover" || kind === "thumbnail") {
        const finalizeResponse = await fetch("/api/uploads/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceVersionId,
            kind,
            locale: "en",
            originalName: file.name,
            mimeType,
            sizeBytes: file.size,
            url: blob.url,
            pathname: blob.pathname,
          }),
        });
        const finalized = (await finalizeResponse.json().catch(() => ({}))) as { error?: string };
        if (!finalizeResponse.ok) {
          throw new Error(finalized.error ?? "The artwork could not be saved.");
        }
      }
      setUploadProgress((current) => ({ ...current, [key]: 100 }));
      setStatus(`${file.name} uploaded.`);
      router.refresh();
      return blob.url;
    } catch (error) {
      setUploadProgress((current) => ({ ...current, [key]: 0 }));
      setStatus(
        error instanceof Error ? error.message : "The upload could not complete.",
      );
      return undefined;
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
          {editing && initialValue.resourceType === "module" ? <a href="#module-releases">Module publisher</a> : null}
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
                onChanged={changed}
                onImageUpload={(file) =>
                  uploadFile("descriptionImage", file, item)
                }
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

        {editing && initialValue.resourceType === "module" ? (
          <ModuleReleaseManager resourceId={initialValue.id} accessMode={accessMode} />
        ) : null}

        <section className="admin-editor-section" id="files">
          <SectionHeading
            eyebrow="Shared artwork and localized files"
            title="Files and artwork"
            description="Cover and thumbnail artwork is shared by every language. Downloadable files use the selected language."
          />
          {!editing ? (
            <div className="admin-callout">
              Save the draft once to enable its secure upload areas.
            </div>
          ) : null}
          {editing ? <div className="upload-card-grid">
            {(
              [
                ["cover", "Cover image", "PNG, JPG or WebP"],
                ["thumbnail", "Card thumbnail", "PNG, JPG or WebP"],
                ["module", "Foundry module", "ZIP, up to 250 MB"],
                ["pdf", "PDF document", "PDF, up to 250 MB"],
                ["macro", "Foundry macro", "JS or JSON, up to 250 MB"],
                ["manifest", "Manifest", "JSON"],
              ] as const
            )
              .filter(([kind]) => !(editing && initialValue.resourceType === "module" && kind === "module"))
              .map(([kind, title, hint]) => {
              const fileLocale = kind === "cover" || kind === "thumbnail" ? "en" : locale;
              const key = `${fileLocale}-${kind}`;
              const progress = uploadProgress[key] ?? 0;
              const existingFile =
                editing
                  ? initialValue.files.find(
                      (file) => file.kind === kind && file.locale === fileLocale,
                    )
                  : null;
              const artworkUrl =
                editing && kind === "cover"
                  ? initialValue.coverUrl
                  : editing && kind === "thumbnail"
                    ? initialValue.thumbnailUrl
                    : null;
              return (
                <label className="upload-card" key={kind}>
                  {artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="upload-card-preview" src={artworkUrl} alt="" />
                  ) : null}
                  <span>{title}</span>
                  <small>
                    {existingFile
                      ? `${existingFile.originalName} · ${formatBytes(existingFile.sizeBytes)}`
                      : hint}
                  </small>
                  <input
                    type="file"
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
          </div> : null}
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

        <div className="admin-editor-actions">
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
  onChanged,
  onImageUpload,
}: {
  locale: "en" | "es";
  value: ResourceTranslationInput;
  onChanged: () => void;
  onImageUpload: (file: File) => Promise<string | undefined>;
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
      <MarkdownDescriptionEditor
        name={`${locale}Description`}
        value={value.description}
        onChanged={onChanged}
        onImageUpload={onImageUpload}
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

function MarkdownDescriptionEditor({
  name,
  value,
  onChanged,
  onImageUpload,
}: {
  name: string;
  value: string;
  onChanged: () => void;
  onImageUpload: (file: File) => Promise<string | undefined>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [markdown, setMarkdown] = useState(value);
  const [uploading, setUploading] = useState(false);

  function replaceSelection(prefix: string, suffix: string, placeholder: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = markdown.slice(start, end) || placeholder;
    const next = `${markdown.slice(0, start)}${prefix}${selected}${suffix}${markdown.slice(end)}`;
    setMarkdown(next);
    onChanged();
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  async function addImage(file: File) {
    setUploading(true);
    const url = await onImageUpload(file);
    setUploading(false);
    if (!url) return;
    const textarea = textareaRef.current;
    const position = textarea?.selectionStart ?? markdown.length;
    const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    const insertion = `\n\n![${alt}](${url})\n\n`;
    setMarkdown(`${markdown.slice(0, position)}${insertion}${markdown.slice(position)}`);
    onChanged();
    window.requestAnimationFrame(() => textarea?.focus());
  }

  return (
    <div className="markdown-editor">
      <div className="markdown-editor-heading">
        <label htmlFor={name}>Full description</label>
        <small>Markdown formatting is supported.</small>
      </div>
      <div className="markdown-toolbar" aria-label="Description formatting tools">
        <button type="button" onClick={() => replaceSelection("**", "**", "bold text")}><MarkdownToolbarIcon name="bold" /><span>Bold</span></button>
        <button type="button" onClick={() => replaceSelection("_", "_", "italic text")}><MarkdownToolbarIcon name="italic" /><span>Italic</span></button>
        <button type="button" onClick={() => replaceSelection("## ", "", "Heading")}><MarkdownToolbarIcon name="heading" /><span>Heading</span></button>
        <button type="button" onClick={() => replaceSelection("- ", "", "List item")}><MarkdownToolbarIcon name="list" /><span>List</span></button>
        <button type="button" onClick={() => replaceSelection("[", "](https://example.com)", "link text")}><MarkdownToolbarIcon name="link" /><span>Link</span></button>
        <label className={`markdown-image-button ${uploading ? "uploading" : ""}`}>
          <MarkdownToolbarIcon name="image" />
          <span>{uploading ? "Uploading…" : "Add image"}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void addImage(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      <textarea
        id={name}
        ref={textareaRef}
        name={name}
        value={markdown}
        maxLength={20_000}
        onChange={(event) => setMarkdown(event.target.value)}
      />
    </div>
  );
}

function MarkdownToolbarIcon({
  name,
}: {
  name: "bold" | "italic" | "heading" | "list" | "link" | "image";
}) {
  const paths = {
    bold: <><path d="M6 3.5h5a3 3 0 0 1 0 6H6z" /><path d="M6 9.5h5.8a3.5 3.5 0 0 1 0 7H6z" /></>,
    italic: <><path d="M9.5 3.5h5" /><path d="M5.5 16.5h5" /><path d="m12 3.5-4 13" /></>,
    heading: <><path d="M3.5 4v12" /><path d="M11 4v12" /><path d="M3.5 10h7.5" /><path d="M14 10.5a2 2 0 1 1 3.8.8c0 1.6-3.8 2.4-3.8 4.7h4" /></>,
    list: <><path d="M7 5h10" /><path d="M7 10h10" /><path d="M7 15h10" /><circle cx="3.5" cy="5" r=".75" fill="currentColor" stroke="none" /><circle cx="3.5" cy="10" r=".75" fill="currentColor" stroke="none" /><circle cx="3.5" cy="15" r=".75" fill="currentColor" stroke="none" /></>,
    link: <><path d="m8 12 4-4" /><path d="M6.5 13.5 5 15a3 3 0 0 1-4.2-4.2l3-3A3 3 0 0 1 8 7" /><path d="M12 13a3 3 0 0 0 4.2-.2l3-3A3 3 0 0 0 15 5.6L13.5 7" /></>,
    image: <><rect x="2.5" y="3.5" width="15" height="13" rx="1" /><circle cx="7" cy="8" r="1.5" /><path d="m3 15 4.5-4 3 2.5 2.5-2 4 3.5" /></>,
  };
  return <svg className="markdown-toolbar-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">{paths[name]}</svg>;
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
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) return "application/zip";
  if (name.endsWith(".json")) return "application/json";
  if (name.endsWith(".js")) return "text/javascript";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function acceptForKind(kind: FileKind): string {
  switch (kind) {
    case "cover":
    case "thumbnail":
      return ".png,.jpg,.jpeg,.webp";
    case "descriptionImage":
      return ".png,.jpg,.jpeg,.gif,.webp";
    case "module":
      return ".zip";
    case "pdf":
      return ".pdf";
    case "macro":
      return ".js,.json";
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
