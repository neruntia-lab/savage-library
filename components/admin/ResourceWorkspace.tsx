"use client";

import { requestJson } from "../../lib/client/request";
import { EMPTY_UPLOAD, isArtworkKind } from "../../lib/client/resource-upload";
import { buildResourcePayload } from "../../lib/client/resource-form";
import { useResourceUploads } from "./useResourceUploads";
import { TranslationFields } from "./TranslationFields";
import { DependenciesEditor } from "./DependenciesEditor";
import { Field, TextArea, SelectField, SectionHeading } from "./EditorFields";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CatalogFacets, FileKind } from "../../lib/domain/resource";
import type { ResourceInput } from "../../lib/validation/resource";
import type { EditingResource } from "./types";
import { ModuleReleaseManager } from "./ModuleReleaseManager";
import { foundryManifestUrl } from "../../lib/config/site";

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
  const changeCounterRef = useRef(0);
  const lastAttemptRef = useRef(-1);
  const artworkUploadActiveRef = useRef(false);
  const editing = "id" in initialValue;
  const resourceId = editing ? initialValue.id : null;
  const resourceVersionId = editing ? initialValue.resourceVersionId : null;
  const [locale, setLocale] = useState<"en" | "es">("en");
  const [accessMode, setAccessMode] = useState<"public" | "patreon">(
    initialValue.accessMode,
  );
  const [resourceType, setResourceType] = useState(initialValue.resourceType);
  const [resourceSlug, setResourceSlug] = useState(initialValue.slug);
  const [manifestValue, setManifestValue] = useState(
    initialValue.manifestUrl ?? "",
  );
  const [dependencies, setDependencies] = useState(initialValue.dependencies);
  const [status, setStatus] = useState(
    editing
      ? "All changes saved."
      : "Start with a title. You can save a draft at any time.",
  );
  const [changeVersion, setChangeVersion] = useState(0);
  const [localArtwork, setArtwork] = useState({
    coverUrl: editing ? (initialValue.coverUrl ?? null) : null,
    thumbnailUrl: editing ? (initialValue.thumbnailUrl ?? null) : null,
    iconUrl: editing ? (initialValue.iconUrl ?? null) : null,
  });
  const [useIconEverywhere, setUseIconEverywhere] = useState(
    initialValue.useIconEverywhere ?? false,
  );
  const [busy, setBusy] = useState(false);
  const fileUploads = useResourceUploads({
    resourceId,
    resourceVersionId,
    onStatus: setStatus,
    onPreview: (kind, url) =>
      setArtwork((current) => ({ ...current, [`${kind}Url`]: url })),
    onArtwork: (confirmed, kind) =>
      setArtwork((current) => ({
        ...current,
        [`${kind}Url`]: confirmed[`${kind}Url`],
      })),
  });
  const artworkUploads = {
    cover: fileUploads.uploads.cover ?? EMPTY_UPLOAD,
    thumbnail: fileUploads.uploads.thumbnail ?? EMPTY_UPLOAD,
    icon: fileUploads.uploads.icon ?? EMPTY_UPLOAD,
  };
  const artworkUploadActive = fileUploads.busy;
  const uploadProgress = Object.fromEntries(
    Object.entries(fileUploads.uploads).map(([key, state]) => [
      key,
      state.progress,
    ]),
  );

  const artwork = Object.fromEntries(
    (["cover", "thumbnail", "icon"] as const).map((kind) => [
      `${kind}Url`,
      fileUploads.uploads[kind]
        ? localArtwork[`${kind}Url`]
        : editing
          ? (initialValue[`${kind}Url`] ?? null)
          : null,
    ]),
  ) as typeof localArtwork;

  useEffect(() => {
    artworkUploadActiveRef.current = artworkUploadActive;
  }, [artworkUploadActive]);

  useEffect(() => {
    if (
      !editing ||
      changeVersion === 0 ||
      busy ||
      artworkUploadActive ||
      lastAttemptRef.current === changeCounterRef.current
    )
      return;
    const timer = window.setTimeout(() => {
      void saveResource({ autosave: true });
    }, 1800);
    return () => window.clearTimeout(timer);
    // The counter deliberately snapshots the latest uncontrolled form values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeVersion, busy, artworkUploadActive]);

  function changed() {
    changeCounterRef.current += 1;
    setStatus("Unsaved changes");
    setChangeVersion((value) => value + 1);
  }

  async function saveResource(options?: {
    autosave?: boolean;
    publish?: boolean;
  }) {
    if (
      !formRef.current ||
      savingRef.current ||
      artworkUploadActiveRef.current
    ) {
      if (artworkUploadActiveRef.current) {
        setStatus("Wait for artwork uploads to finish before saving.");
      }
      return;
    }
    savingRef.current = true;
    const savedChangeCounter = changeCounterRef.current;
    lastAttemptRef.current = savedChangeCounter;
    setBusy(true);
    setStatus(
      options?.autosave
        ? "Autosaving…"
        : options?.publish
          ? "Publishing…"
          : "Saving…",
    );

    const payload = buildResourcePayload(
      new FormData(formRef.current),
      dependencies,
      accessMode,
      options?.publish ?? initialValue.isPublished,
    );
    if (options?.autosave) {
      payload.changelogSummary = "";
      payload.changelogDetails = "";
    }
    const { ok, body } = await requestJson<{
      id?: string;
      error?: string;
      errors?: Record<string, string>;
    }>(resourceId ? `/api/resources/${resourceId}` : "/api/resources", {
      method: resourceId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    savingRef.current = false;
    setBusy(false);
    if (!ok) {
      setStatus(
        body.error ??
          Object.values(body.errors ?? {})[0] ??
          "The resource could not be saved.",
      );
      return;
    }

    if (savedChangeCounter !== changeCounterRef.current) {
      setStatus("Unsaved changes");
      return;
    }
    setChangeVersion(0);
    setStatus(
      options?.publish ? "Published successfully." : "All changes saved.",
    );
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
  ) {
    const url = await fileUploads.uploadFile(kind, file, targetLocale);
    if (url && !isArtworkKind(kind)) router.refresh();
    return url;
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
          {editing && initialValue.resourceType === "module" ? (
            <a href="#module-releases">Module publisher</a>
          ) : null}
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
                  setResourceSlug(slugInput.value);
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
                setResourceSlug(event.currentTarget.value);
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
                ["macro", "Macro"],
                ["class", "Class"],
                ["subclass", "Subclass"],
              ]}
              onChange={(event) =>
                setResourceType(
                  event.currentTarget.value as ResourceInput["resourceType"],
                )
              }
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
          <ModuleReleaseManager
            resourceId={initialValue.id}
            accessMode={accessMode}
          />
        ) : null}

        <section className="admin-editor-section" id="files">
          <SectionHeading
            eyebrow="Shared artwork and localized files"
            title="Files and artwork"
            description="Resource icon, cover, and thumbnail artwork is shared by every language. Downloadable files use the selected language."
          />
          {!editing ? (
            <div className="admin-callout">
              Save the draft once to enable its secure upload areas.
            </div>
          ) : null}
          {editing ? (
            <div className="upload-card-grid">
              {(
                [
                  ["cover", "Cover image", "PNG, JPG or WebP"],
                  ["thumbnail", "Card thumbnail", "PNG, JPG or WebP"],
                  [
                    "icon",
                    "Resource icon",
                    "Square PNG, JPG or WebP, up to 10 MB",
                  ],
                  ["module", "Foundry module", "ZIP, up to 250 MB"],
                  ["pdf", "PDF document", "PDF, up to 250 MB"],
                  ["macro", "Foundry macro", "JS or JSON, up to 250 MB"],
                  ["manifest", "Manifest", "JSON"],
                ] as const
              )
                .filter(
                  ([kind]) =>
                    !(
                      editing &&
                      initialValue.resourceType === "module" &&
                      kind === "module"
                    ),
                )
                .map(([kind, title, hint]) => {
                  const fileLocale =
                    kind === "cover" || kind === "thumbnail" || kind === "icon"
                      ? "en"
                      : locale;
                  const key = `${fileLocale}-${kind}`;
                  const progress = uploadProgress[key] ?? 0;
                  const existingFile = editing
                    ? initialValue.files.find(
                        (file) =>
                          file.kind === kind && file.locale === fileLocale,
                      )
                    : null;
                  const artworkUrl =
                    editing && kind === "cover"
                      ? artwork.coverUrl
                      : editing && kind === "thumbnail"
                        ? artwork.thumbnailUrl
                        : editing && kind === "icon"
                          ? artwork.iconUrl
                          : null;
                  const artworkState = isArtworkKind(kind)
                    ? artworkUploads[kind]
                    : null;
                  const uploadDisabled =
                    artworkState?.phase === "uploading" ||
                    artworkState?.phase === "saving";
                  return (
                    <label
                      className={`upload-card${uploadDisabled ? " uploading" : ""}${artworkState?.phase === "error" ? " upload-error" : ""}`}
                      key={kind}
                    >
                      {artworkUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="upload-card-preview"
                          src={artworkUrl}
                          alt=""
                        />
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
                        disabled={uploadDisabled}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) void uploadFile(kind, file);
                          event.currentTarget.value = "";
                        }}
                      />
                      {artworkState && artworkState.phase !== "idle" ? (
                        <span className="upload-feedback" aria-live="polite">
                          <span className="upload-feedback-row">
                            <strong>{artworkState.fileName}</strong>
                            <em>
                              {artworkState.phase === "uploading"
                                ? `${artworkState.progress}%`
                                : artworkState.phase === "saving"
                                  ? "Saving image…"
                                  : artworkState.phase === "complete"
                                    ? "Saved"
                                    : "Not saved"}
                            </em>
                          </span>
                          {artworkState.phase === "uploading" ||
                          artworkState.phase === "saving" ? (
                            <span
                              className={`upload-progress${artworkState.phase === "saving" ? " saving" : ""}`}
                              role="progressbar"
                              aria-label={`Uploading ${artworkState.fileName ?? title}`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={
                                artworkState.phase === "uploading"
                                  ? artworkState.progress
                                  : undefined
                              }
                            >
                              <i
                                style={{ width: `${artworkState.progress}%` }}
                              />
                            </span>
                          ) : null}
                          {artworkState.error ? (
                            <small className="upload-error-message">
                              {artworkState.error} Select the file again to
                              retry.
                            </small>
                          ) : null}
                        </span>
                      ) : progress > 0 ? (
                        <span
                          className="upload-progress"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={progress}
                        >
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
          ) : null}
          {editing ? (
            <label
              className={`featured-toggle ${!artwork.iconUrl ? "disabled" : ""}`}
            >
              <input
                type="checkbox"
                name="useIconEverywhere"
                checked={useIconEverywhere}
                disabled={!artwork.iconUrl}
                onChange={(event) => {
                  setUseIconEverywhere(event.currentTarget.checked);
                  changed();
                }}
              />
              <span>
                <strong>Use resource icon everywhere</strong>
                <small>
                  {artwork.iconUrl
                    ? "Override the card thumbnail and cover display with this icon. Uncheck to restore dedicated artwork."
                    : "Upload and confirm a resource icon before enabling this option."}
                </small>
              </span>
            </label>
          ) : null}
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
            <label>
              <span>Manifest URL</span>
              <input
                name="manifestUrl"
                type="url"
                value={
                  resourceType === "module" && resourceSlug
                    ? foundryManifestUrl(resourceSlug)
                    : manifestValue
                }
                readOnly={resourceType === "module"}
                onChange={(event) =>
                  setManifestValue(event.currentTarget.value)
                }
              />
              {resourceType === "module" ? (
                <small>Generated from the stable production domain.</small>
              ) : null}
            </label>
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
              disabled={busy || artworkUploadActive}
            >
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={busy || artworkUploadActive}
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

function acceptForKind(kind: FileKind): string {
  switch (kind) {
    case "cover":
    case "thumbnail":
    case "icon":
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
