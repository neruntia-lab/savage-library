import type { CatalogFacets } from "../../lib/domain/resource";
import type { ResourceInput } from "../../lib/validation/resource";

export function ResourceEditor({
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
