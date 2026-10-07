/* eslint-disable @next/next/no-img-element -- Object URLs provide immediate upload previews. */
import type {
  CatalogFacets,
  FileKind,
  ResourceType,
} from "../../lib/domain/resource";
import type { ResourceInput } from "../../lib/validation/resource";
import {
  wizardSlug,
  type WizardCheck,
} from "../../lib/services/resource-wizard";
import type {
  UploadState,
  ArtworkKind,
} from "../../lib/client/resource-upload";
import { ModuleReleaseManager } from "./ModuleReleaseManager";
import type { EditingResource } from "./types";
type Tier = {
  id: string;
  title: string;
  amountCents: number;
  isPublished: boolean;
};

const TYPES: Array<{ id: ResourceType; title: string; detail: string }> = [
  {
    id: "module",
    title: "Foundry module",
    detail: "Installable ZIP with a stable Foundry manifest.",
  },
  {
    id: "pdf",
    title: "PDF",
    detail: "A downloadable guide, supplement, or document.",
  },
  { id: "macro", title: "Macro", detail: "A Foundry JS or JSON automation." },
  { id: "class", title: "Class", detail: "A complete character class entry." },
  {
    id: "subclass",
    title: "Subclass",
    detail: "A character subclass or specialization.",
  },
];

export function ChooseStep({ draft, errors, onChange }: StepProps) {
  return (
    <section>
      <Heading
        number="01"
        title="What are you adding?"
        text="Choose the closest content type. The next steps will adapt automatically."
      />
      <div>
        <RequiredLabel>Content type</RequiredLabel>
      </div>
      <div className="wizard-type-grid">
        {TYPES.map((type) => (
          <label
            key={type.id}
            className={draft.resourceType === type.id ? "selected" : ""}
          >
            <input
              type="radio"
              name="resourceType"
              checked={draft.resourceType === type.id}
              onChange={() => onChange("resourceType", type.id)}
            />
            <strong>{type.title}</strong>
            <span>{type.detail}</span>
          </label>
        ))}
      </div>
      <div className="form-grid form-grid-two">
        <WizardInput
          label="Internal title"
          name="title"
          value={draft.title}
          error={errors.title}
          required
          onChange={(value) => {
            onChange("title", value);
            onChange("slug", wizardSlug(value));
            const locale = draft.defaultLocale;
            onChange("translations", {
              ...draft.translations,
              [locale]: { ...draft.translations[locale], title: value },
            });
          }}
        />
        <label>
          <RequiredLabel>Default language</RequiredLabel>
          <select
            name="defaultLocale"
            required
            value={draft.defaultLocale}
            onChange={(event) =>
              onChange("defaultLocale", event.target.value as "en" | "es")
            }
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
          </select>
        </label>
      </div>
      <details className="wizard-advanced">
        <summary>Advanced URL settings</summary>
        <WizardInput
          label="URL slug"
          name="slug"
          value={draft.slug}
          error={errors.slug}
          required
          onChange={(value) => onChange("slug", wizardSlug(value))}
        />
      </details>
    </section>
  );
}

export function DescribeStep({
  draft,
  errors,
  primary,
  secondary,
  showSecond,
  setShowSecond,
  changeTranslation,
  upload,
  uploadState,
}: {
  draft: ResourceInput;
  errors: Record<string, string>;
  primary: "en" | "es";
  secondary: "en" | "es";
  showSecond: boolean;
  setShowSecond: (value: boolean) => void;
  changeTranslation: (
    locale: "en" | "es",
    key: "title" | "shortDescription" | "description",
    value: string,
  ) => void;
  upload: (file: File) => void;
  uploadState?: UploadState;
}) {
  const fields = (locale: "en" | "es") => (
    <div className="wizard-language-fields">
      <WizardInput
        label={locale === "en" ? "English title" : "Título en español"}
        name={`${locale}Title`}
        value={draft.translations[locale].title}
        error={errors[`${locale}Title`]}
        required={locale === primary}
        onChange={(value) => changeTranslation(locale, "title", value)}
      />
      <label>
        <span>
          {locale === primary ? (
            <RequiredLabel>Short description</RequiredLabel>
          ) : (
            "Short description"
          )}
        </span>
        <textarea
          required={locale === primary}
          aria-invalid={Boolean(errors[`${locale}ShortDescription`])}
          aria-describedby={
            errors[`${locale}ShortDescription`]
              ? `${locale}ShortDescription-error`
              : undefined
          }
          name={`${locale}ShortDescription`}
          maxLength={240}
          value={draft.translations[locale].shortDescription}
          onChange={(event) =>
            changeTranslation(locale, "shortDescription", event.target.value)
          }
        />
        <small>
          {draft.translations[locale].shortDescription.length}/240 characters
        </small>
        {errors[`${locale}ShortDescription`] ? (
          <small id={`${locale}ShortDescription-error`} className="field-error">
            {errors[`${locale}ShortDescription`]}
          </small>
        ) : null}
      </label>
      <label>
        <span>Full description</span>
        <textarea
          name={`${locale}Description`}
          className="wizard-description"
          value={draft.translations[locale].description}
          onChange={(event) =>
            changeTranslation(locale, "description", event.target.value)
          }
        />
        <small>Markdown formatting is supported.</small>
      </label>
      {locale === primary ? (
        <UploadButton
          label="Add description image"
          accept="image/png,image/jpeg,image/webp,image/gif"
          state={uploadState}
          onFile={upload}
        />
      ) : null}
    </div>
  );
  return (
    <section>
      <Heading
        number="02"
        title="Describe the content"
        text="Write the information visitors should see on the public page."
      />
      {fields(primary)}
      <label className="wizard-secondary-toggle">
        <input
          type="checkbox"
          checked={showSecond}
          onChange={(event) => setShowSecond(event.target.checked)}
        />{" "}
        Add {secondary === "en" ? "English" : "Spanish"} translation
      </label>
      {showSecond ? fields(secondary) : null}
    </section>
  );
}

export function OrganizeStep({
  draft,
  facets,
  errors,
  tagQuery,
  setTagQuery,
  visibleTags,
  onChange,
}: StepProps & {
  facets: CatalogFacets;
  tagQuery: string;
  setTagQuery: (value: string) => void;
  visibleTags: CatalogFacets["tags"];
}) {
  return (
    <section>
      <Heading
        number="03"
        title="Help people find it"
        text="We selected sensible defaults. Adjust only what this resource needs."
      />
      <div className="form-grid form-grid-three">
        <WizardSelect
          label="Category"
          name="categoryId"
          required
          error={errors.categoryId}
          value={draft.categoryId}
          options={facets.categories}
          onChange={(value) => onChange("categoryId", value)}
        />
        <WizardSelect
          label="Game system"
          name="gameSystemId"
          required
          error={errors.gameSystemId}
          value={draft.gameSystemId}
          options={facets.gameSystems}
          onChange={(value) => onChange("gameSystemId", value)}
        />
        <WizardSelect
          label="Author"
          name="authorId"
          required
          error={errors.authorId}
          value={draft.authorId}
          options={facets.authors}
          onChange={(value) => onChange("authorId", value)}
        />
      </div>
      {draft.resourceType === "class" ? (
        <WizardInput
          label="Class name"
          name="className"
          required
          value={draft.className ?? ""}
          error={errors.className}
          onChange={(value) => onChange("className", value)}
        />
      ) : null}
      {draft.resourceType === "subclass" ? (
        <div className="form-grid form-grid-two">
          <WizardInput
            label="Parent class"
            name="className"
            required
            error={errors.className}
            value={draft.className ?? ""}
            onChange={(value) => onChange("className", value)}
          />
          <WizardInput
            label="Subclass name"
            name="subclassName"
            required
            error={errors.subclassName}
            value={draft.subclassName ?? ""}
            onChange={(value) => onChange("subclassName", value)}
          />
        </div>
      ) : null}
      <label>
        <span>Search tags</span>
        <input
          value={tagQuery}
          onChange={(event) => setTagQuery(event.target.value)}
          placeholder="Search tags…"
        />
      </label>
      <div className="wizard-tag-grid">
        {visibleTags.map((tag) => (
          <label
            key={tag.id}
            className={draft.tagIds.includes(tag.id) ? "selected" : ""}
          >
            <input
              type="checkbox"
              checked={draft.tagIds.includes(tag.id)}
              onChange={(event) =>
                onChange(
                  "tagIds",
                  event.target.checked
                    ? [...draft.tagIds, tag.id]
                    : draft.tagIds.filter((id) => id !== tag.id),
                )
              }
            />
            {tag.name}
          </label>
        ))}
      </div>
    </section>
  );
}

export function ReleaseStep({
  draft,
  resource,
  uploads,
  errors,
  onChange,
  uploadFile,
}: {
  draft: ResourceInput;
  resource: EditingResource;
  uploads: Record<string, UploadState>;
  errors: Record<string, string>;
  onChange: StepProps["onChange"];
  uploadFile: (kind: FileKind, file: File) => Promise<void>;
}) {
  const primaryKind: FileKind =
    draft.resourceType === "macro" ? "macro" : "pdf";
  return (
    <section>
      <Heading
        number="04"
        title="Add the release"
        text="Upload the content people will receive, then add optional artwork."
      />
      {draft.resourceType === "module" ? (
        <div
          className={`wizard-required-panel ${errors.release ? "has-error" : ""}`}
          data-error-key="release"
          tabIndex={errors.release ? -1 : undefined}
          aria-invalid={Boolean(errors.release)}
        >
          <RequiredLabel>Validated module release</RequiredLabel>
          <ModuleReleaseManager
            resourceId={resource.id}
            accessMode={draft.accessMode}
          />
          {errors.release ? (
            <small className="field-error">{errors.release}</small>
          ) : null}
        </div>
      ) : (
        <div
          className={`wizard-primary-upload wizard-required-panel ${errors[primaryKind] ? "has-error" : ""}`}
          data-error-key={primaryKind}
          tabIndex={errors[primaryKind] ? -1 : undefined}
          aria-invalid={Boolean(errors[primaryKind])}
        >
          {draft.resourceType === "class" ||
          draft.resourceType === "subclass" ? (
            <span>Supporting file (optional)</span>
          ) : (
            <RequiredLabel>Primary file</RequiredLabel>
          )}
          <UploadButton
            label={
              draft.resourceType === "macro"
                ? "Upload macro (JS or JSON)"
                : draft.resourceType === "pdf"
                  ? "Upload PDF"
                  : "Optional supporting PDF"
            }
            accept={draft.resourceType === "macro" ? ".js,.json" : ".pdf"}
            state={uploads[primaryKind]}
            onFile={(file) => void uploadFile(primaryKind, file)}
          />
          {errors[primaryKind] ? (
            <small className="field-error">{errors[primaryKind]}</small>
          ) : null}
        </div>
      )}
      {draft.resourceType !== "module" ? (
        <div className="form-grid form-grid-two">
          <WizardInput
            label="Version"
            name="currentVersion"
            required
            error={errors.currentVersion}
            value={draft.currentVersion}
            onChange={(value) => onChange("currentVersion", value)}
          />
          <label>
            <RequiredLabel>Compatibility</RequiredLabel>
            <select
              name="compatibilityStatus"
              required
              value={draft.compatibilityStatus}
              onChange={(event) =>
                onChange(
                  "compatibilityStatus",
                  event.target.value as ResourceInput["compatibilityStatus"],
                )
              }
            >
              {[
                "verified",
                "compatible",
                "untested",
                "outdated",
                "unsupported",
              ].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <h3>Optional artwork</h3>
      <div className="wizard-artwork-grid">
        {(["icon", "cover", "thumbnail"] as ArtworkKind[]).map((kind) => (
          <div key={kind}>
            {resource[`${kind}Url`] ? (
              <img src={resource[`${kind}Url`] ?? ""} alt="" />
            ) : null}
            <UploadButton
              label={
                kind === "icon"
                  ? "Resource icon"
                  : kind === "cover"
                    ? "Cover image"
                    : "Card thumbnail"
              }
              accept="image/png,image/jpeg,image/webp"
              state={uploads[kind]}
              onFile={(file) => void uploadFile(kind, file)}
            />
          </div>
        ))}
      </div>
      <label className="wizard-secondary-toggle">
        <input
          type="checkbox"
          checked={draft.useIconEverywhere}
          disabled={!resource.iconUrl && uploads.icon?.phase !== "complete"}
          onChange={(event) =>
            onChange("useIconEverywhere", event.target.checked)
          }
        />{" "}
        Use the resource icon everywhere
      </label>
    </section>
  );
}

export function AccessStep({
  draft,
  tiers,
  errors,
  onChange,
}: StepProps & { tiers: Tier[] }) {
  return (
    <section>
      <Heading
        number="05"
        title="Choose who can access it"
        text="One clear choice controls both access and the catalog price label."
      />
      <RequiredLabel>Access level</RequiredLabel>
      <div className="wizard-access-grid">
        <label className={draft.accessMode === "public" ? "selected" : ""}>
          <input
            type="radio"
            checked={draft.accessMode === "public"}
            onChange={() => {
              onChange("accessMode", "public");
              onChange("pricing", "free");
            }}
          />
          <strong>Free and public</strong>
          <span>Anyone can access the published content.</span>
        </label>
        <label className={draft.accessMode === "patreon" ? "selected" : ""}>
          <input
            type="radio"
            checked={draft.accessMode === "patreon"}
            onChange={() => {
              onChange("accessMode", "patreon");
              onChange("pricing", "premium");
            }}
          />
          <strong>Patreon members</strong>
          <span>Only selected active tiers can access it.</span>
        </label>
      </div>
      {draft.resourceType === "module" && draft.accessMode === "patreon" ? (
        <div className="wizard-warning">
          Paid Foundry module distribution is not supported yet. You can save
          this setup as a draft, but it cannot be published.
        </div>
      ) : null}
      {draft.accessMode === "patreon" ? (
        <fieldset
          className={
            errors.patreonTierIds
              ? "wizard-tier-fieldset has-error"
              : "wizard-tier-fieldset"
          }
          data-error-key="patreonTierIds"
          tabIndex={errors.patreonTierIds ? -1 : undefined}
          aria-invalid={Boolean(errors.patreonTierIds)}
        >
          <legend>
            <RequiredLabel>Qualifying Patreon tiers</RequiredLabel>
          </legend>
          <div className="wizard-tier-grid">
            {tiers
              .filter((tier) => tier.isPublished)
              .map((tier) => (
                <label
                  key={tier.id}
                  className={
                    draft.patreonTierIds.includes(tier.id) ? "selected" : ""
                  }
                >
                  <input
                    type="checkbox"
                    checked={draft.patreonTierIds.includes(tier.id)}
                    onChange={(event) =>
                      onChange(
                        "patreonTierIds",
                        event.target.checked
                          ? [...draft.patreonTierIds, tier.id]
                          : draft.patreonTierIds.filter((id) => id !== tier.id),
                      )
                    }
                  />
                  <strong>{tier.title}</strong>
                  <span>${(tier.amountCents / 100).toFixed(2)} / month</span>
                </label>
              ))}
          </div>
          {errors.patreonTierIds ? (
            <small className="field-error">{errors.patreonTierIds}</small>
          ) : null}
        </fieldset>
      ) : null}
      <details className="wizard-advanced">
        <summary>Advanced publishing details</summary>
        <div className="form-grid form-grid-two">
          <WizardInput
            label="Project URL"
            name="projectUrl"
            value={draft.projectUrl ?? ""}
            onChange={(value) => onChange("projectUrl", value)}
          />
          <WizardInput
            label="License"
            name="licenseName"
            value={draft.licenseName ?? ""}
            onChange={(value) => onChange("licenseName", value)}
          />
        </div>
        <label className="wizard-secondary-toggle">
          <input
            type="checkbox"
            checked={draft.isFeatured}
            onChange={(event) => onChange("isFeatured", event.target.checked)}
          />{" "}
          Feature this resource on the home page
        </label>
      </details>
    </section>
  );
}

export function ReviewStep({
  resource,
  checks,
}: {
  resource: EditingResource;
  checks: WizardCheck[];
}) {
  return (
    <section>
      <Heading
        number="06"
        title="Review before finishing"
        text="Required items block publication. Recommendations can be completed later."
      />
      <div className="wizard-check-columns">
        {(["required", "recommended", "confirmed"] as const).map((level) => (
          <div key={level} className={`wizard-check-list ${level}`}>
            <h3>
              {level === "required"
                ? "Required corrections"
                : level === "recommended"
                  ? "Optional recommendations"
                  : "Confirmed"}
            </h3>
            <ul>
              {checks
                .filter((item) => item.level === level)
                .map((item) => (
                  <li key={`${item.step}-${item.message}`}>
                    <span aria-hidden="true">
                      {level === "confirmed"
                        ? "✓"
                        : level === "required"
                          ? "!"
                          : "•"}
                    </span>
                    <span>{item.message}</span>
                  </li>
                ))}
            </ul>
            {!checks.some((item) => item.level === level) ? <p>None.</p> : null}
          </div>
        ))}
      </div>
      <div className="wizard-preview">
        <iframe
          title="Resource preview"
          src={`/admin/resources/${resource.id}/preview`}
        />
      </div>
    </section>
  );
}

type StepProps = {
  draft: ResourceInput;
  errors: Record<string, string>;
  onChange: <K extends keyof ResourceInput>(
    key: K,
    value: ResourceInput[K],
  ) => void;
};
function Heading({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="wizard-section-heading">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}
function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <span>
      {children}{" "}
      <b className="required-marker" aria-hidden="true">
        *
      </b>
      <span className="sr-only"> (required)</span>
    </span>
  );
}
function WizardInput({
  label,
  name,
  value,
  error,
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  error?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{required ? <RequiredLabel>{label}</RequiredLabel> : label}</span>
      <input
        name={name}
        value={value}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <small id={`${name}-error`} className="field-error">
          {error}
        </small>
      ) : null}
    </label>
  );
}
function WizardSelect({
  label,
  name,
  value,
  options,
  error,
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  error?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{required ? <RequiredLabel>{label}</RequiredLabel> : label}</span>
      <select
        name={name}
        value={value}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {error ? (
        <small id={`${name}-error`} className="field-error">
          {error}
        </small>
      ) : null}
    </label>
  );
}
function UploadButton({
  label,
  accept,
  state,
  onFile,
}: {
  label: string;
  accept: string;
  state?: UploadState;
  onFile: (file: File) => void;
}) {
  const active = state?.phase === "uploading" || state?.phase === "saving";
  return (
    <label className={`wizard-upload ${state?.phase ?? "idle"}`}>
      <strong>{label}</strong>
      <span>
        {state?.phase === "complete"
          ? "Saved"
          : state?.phase === "saving"
            ? "Saving…"
            : state?.phase === "uploading"
              ? `${state.progress}%`
              : (state?.error ?? "Choose a file")}
      </span>
      <input
        type="file"
        accept={accept}
        disabled={active}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      {active ? (
        <span
          className="upload-progress"
          role="progressbar"
          aria-valuenow={state?.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${state?.progress ?? 0}%` }} />
        </span>
      ) : null}
    </label>
  );
}

export function emptyWizardValue(facets: CatalogFacets): ResourceInput {
  return {
    title: "",
    slug: "",
    shortDescription: "",
    description: "",
    resourceType: "module",
    categoryId: facets.categories[0]?.id ?? "",
    authorId: facets.authors[0]?.id ?? "",
    gameSystemId: facets.gameSystems[0]?.id ?? "",
    currentVersion: "1.0.0",
    compatibilityStatus: "untested",
    pricing: "free",
    tagIds: [],
    dependencies: [],
    defaultLocale: "en",
    accessMode: "public",
    patreonTierIds: [],
    translations: {
      en: {
        title: "",
        shortDescription: "",
        description: "",
        isPublished: false,
      },
      es: {
        title: "",
        shortDescription: "",
        description: "",
        isPublished: false,
      },
    },
    isFeatured: false,
    useIconEverywhere: false,
    isPublished: false,
  };
}
export function normalizedDraft(value: ResourceInput): ResourceInput {
  const primary = value.translations[value.defaultLocale];
  return {
    ...value,
    title: value.title || primary.title,
    shortDescription: primary.shortDescription,
    description: primary.description,
    pricing: value.accessMode === "public" ? "free" : "premium",
    translations: {
      en: {
        ...value.translations.en,
        isPublished: value.defaultLocale === "en",
      },
      es: {
        ...value.translations.es,
        isPublished: value.defaultLocale === "es",
      },
    },
    isPublished: false,
  };
}
