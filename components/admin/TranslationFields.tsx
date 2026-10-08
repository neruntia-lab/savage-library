"use client";
import { useRef, useState } from "react";
import type { ResourceTranslationInput } from "../../lib/validation/resource";
import { Field, TextArea } from "./EditorFields";

export function TranslationFields({
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

export function MarkdownDescriptionEditor({
  name,
  value,
  onChanged,
  onImageUpload,
  label = "Full description",
  onValueChanged,
  invalid = false,
  required = false,
}: {
  name: string;
  value: string;
  onChanged: () => void;
  onImageUpload?: (file: File) => Promise<string | undefined>;
  label?: string;
  onValueChanged?: (value: string) => void;
  invalid?: boolean;
  required?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [markdown, setMarkdown] = useState(value);
  const [uploading, setUploading] = useState(false);

  function replaceSelection(
    prefix: string,
    suffix: string,
    placeholder: string,
  ) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = markdown.slice(start, end) || placeholder;
    const next = `${markdown.slice(0, start)}${prefix}${selected}${suffix}${markdown.slice(end)}`;
    setMarkdown(next);
    onValueChanged?.(next);
    onChanged();
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length,
      );
    });
  }

  async function addImage(file: File) {
    if (!onImageUpload) return;
    setUploading(true);
    let url: string | undefined;
    try {
      url = await onImageUpload(file);
    } finally {
      setUploading(false);
    }
    if (!url) return;
    const textarea = textareaRef.current;
    const position = textarea?.selectionStart ?? markdown.length;
    const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    const insertion = `\n\n![${alt}](${url})\n\n`;
    const next = `${markdown.slice(0, position)}${insertion}${markdown.slice(position)}`;
    setMarkdown(next);
    onValueChanged?.(next);
    onChanged();
    window.requestAnimationFrame(() => textarea?.focus());
  }

  return (
    <div className="markdown-editor">
      <div className="markdown-editor-heading">
        <label htmlFor={name}>
          {label}
          {required ? (
            <span className="required-marker" aria-hidden="true">
              {" "}
              *
            </span>
          ) : null}
        </label>
        <small>Markdown formatting is supported.</small>
      </div>
      <div
        className="markdown-toolbar"
        aria-label="Description formatting tools"
      >
        <button
          type="button"
          onClick={() => replaceSelection("**", "**", "bold text")}
        >
          <MarkdownToolbarIcon name="bold" />
          <span>Bold</span>
        </button>
        <button
          type="button"
          onClick={() => replaceSelection("_", "_", "italic text")}
        >
          <MarkdownToolbarIcon name="italic" />
          <span>Italic</span>
        </button>
        <button
          type="button"
          onClick={() => replaceSelection("## ", "", "Heading")}
        >
          <MarkdownToolbarIcon name="heading" />
          <span>Heading</span>
        </button>
        <button
          type="button"
          onClick={() => replaceSelection("- ", "", "List item")}
        >
          <MarkdownToolbarIcon name="list" />
          <span>List</span>
        </button>
        <button
          type="button"
          onClick={() =>
            replaceSelection("[", "](https://example.com)", "link text")
          }
        >
          <MarkdownToolbarIcon name="link" />
          <span>Link</span>
        </button>
        {onImageUpload ? (
          <label
            className={`markdown-image-button ${uploading ? "uploading" : ""}`}
          >
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
        ) : (
          <button
            type="button"
            onClick={() =>
              replaceSelection(
                "![",
                "](https://example.com/image.png)",
                "Image description",
              )
            }
          >
            <MarkdownToolbarIcon name="image" />
            <span>Image link</span>
          </button>
        )}
      </div>
      <textarea
        id={name}
        ref={textareaRef}
        name={name}
        value={markdown}
        maxLength={20_000}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        onChange={(event) => {
          setMarkdown(event.target.value);
          onValueChanged?.(event.target.value);
          onChanged();
        }}
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
    bold: (
      <>
        <path d="M6 3.5h5a3 3 0 0 1 0 6H6z" />
        <path d="M6 9.5h5.8a3.5 3.5 0 0 1 0 7H6z" />
      </>
    ),
    italic: (
      <>
        <path d="M9.5 3.5h5" />
        <path d="M5.5 16.5h5" />
        <path d="m12 3.5-4 13" />
      </>
    ),
    heading: (
      <>
        <path d="M3.5 4v12" />
        <path d="M11 4v12" />
        <path d="M3.5 10h7.5" />
        <path d="M14 10.5a2 2 0 1 1 3.8.8c0 1.6-3.8 2.4-3.8 4.7h4" />
      </>
    ),
    list: (
      <>
        <path d="M7 5h10" />
        <path d="M7 10h10" />
        <path d="M7 15h10" />
        <circle cx="3.5" cy="5" r=".75" fill="currentColor" stroke="none" />
        <circle cx="3.5" cy="10" r=".75" fill="currentColor" stroke="none" />
        <circle cx="3.5" cy="15" r=".75" fill="currentColor" stroke="none" />
      </>
    ),
    link: (
      <>
        <path d="m8 12 4-4" />
        <path d="M6.5 13.5 5 15a3 3 0 0 1-4.2-4.2l3-3A3 3 0 0 1 8 7" />
        <path d="M12 13a3 3 0 0 0 4.2-.2l3-3A3 3 0 0 0 15 5.6L13.5 7" />
      </>
    ),
    image: (
      <>
        <rect x="2.5" y="3.5" width="15" height="13" rx="1" />
        <circle cx="7" cy="8" r="1.5" />
        <path d="m3 15 4.5-4 3 2.5 2.5-2 4 3.5" />
      </>
    ),
  };
  return (
    <svg
      className="markdown-toolbar-icon"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    >
      {paths[name]}
    </svg>
  );
}
