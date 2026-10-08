"use client";
import { useEffect, useRef, useState } from "react";
import type {
  AdminWikiGuide,
  WikiContent,
  WikiLocale,
  WikiModule,
} from "../../lib/domain/wiki";
import { emptyWikiContent } from "../../lib/domain/wiki";
import { requestJson, type ApiFailure } from "../../lib/client/request";
import {
  GuidePresentation,
  type WikiDocument,
} from "../wiki/GuidePresentation";
import { MarkdownDescriptionEditor } from "./TranslationFields";

export function WikiGuideEditor({
  initial,
  modules,
  onClose,
  onSaved,
}: {
  initial: AdminWikiGuide | null;
  modules: WikiModule[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saved, setSaved] = useState(initial);
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(initial));
  const [content, setContent] = useState<WikiContent>(
    initial?.draft ?? emptyWikiContent(),
  );
  const [moduleId, setModuleId] = useState(initial?.moduleId ?? "");
  const [locale, setLocale] = useState<WikiLocale>(
    initial?.draft.defaultLocale ?? "en",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<WikiDocument | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (busy) return;
    const first = Object.keys(errors)[0];
    if (first)
      form.current
        ?.querySelector<HTMLElement>(
          `[data-field="${first}"], [name="${first}"]`,
        )
        ?.focus();
  }, [busy, errors, locale]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function changed() {
    setDirty(true);
    setPreview(null);
  }
  function translation(field: "title" | "summary" | "body", value: string) {
    setContent((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: { ...current.translations[locale], [field]: value },
      },
    }));
    changed();
  }
  function showFailure(body: ApiFailure) {
    setStatus(body.error ?? "The guide could not be saved.");
    setErrors(body.errors ?? {});
    const first = Object.keys(body.errors ?? {})[0];
    if (first?.startsWith("en.") || first?.startsWith("es."))
      setLocale(first.slice(0, 2) as WikiLocale);
  }
  async function submit(action: "draft" | "publish" | "unpublish") {
    if (
      action === "publish" &&
      !window.confirm("Publish this guide and make it publicly visible?")
    )
      return;
    if (
      action === "unpublish" &&
      !window.confirm(
        "Remove this guide from the public Wiki? Its draft will be retained.",
      )
    )
      return;
    setBusy(true);
    setStatus(action === "draft" ? "Saving draft…" : "Updating publication…");
    setErrors({});
    try {
      const payload = { slug, moduleId: moduleId || null, content };
      let current = saved;
      if (!current) {
        const created = await requestJson<
          ApiFailure & { guide?: AdminWikiGuide }
        >("/api/admin/wiki", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, action: "draft" }),
        });
        if (!created.ok || !created.body.guide) {
          showFailure(created.body);
          return;
        }
        current = created.body.guide;
        setSaved(current);
        setDirty(false);
        onSaved();
        if (action === "draft") {
          setStatus("Draft saved. It is not public.");
          return;
        }
      }
      const result = await requestJson<ApiFailure & { guide?: AdminWikiGuide }>(
        `/api/admin/wiki/${encodeURIComponent(current.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            action,
            revision: current.revision,
          }),
        },
      );
      if (!result.ok || !result.body.guide) {
        showFailure(result.body);
        return;
      }
      setSaved(result.body.guide);
      setContent(result.body.guide.draft);
      setSlug(result.body.guide.slug);
      setDirty(false);
      onSaved();
      setStatus(
        action === "publish"
          ? "Guide published."
          : action === "unpublish"
            ? "Guide unpublished. Draft retained."
            : "Draft saved. Published content is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function showPreview() {
    setBusy(true);
    setErrors({});
    setStatus("Preparing preview…");
    try {
      const result = await requestJson<
        ApiFailure & { document?: WikiDocument }
      >("/api/admin/wiki/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          moduleId: moduleId || null,
          content,
          locale,
        }),
      });
      if (!result.ok || !result.body.document) {
        showFailure(result.body);
        return;
      }
      setPreview(result.body.document);
      setStatus("Preview ready. No changes were published.");
    } finally {
      setBusy(false);
    }
  }
  const value = content.translations[locale];
  return (
    <div className="wiki-editor">
      <button
        className="button button-secondary"
        type="button"
        disabled={busy}
        onClick={() => {
          if (!dirty || window.confirm("Discard unsaved guide changes?"))
            onClose();
        }}
      >
        ← Guide list
      </button>
      <form
        ref={form}
        className="wiki-panel"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit("draft");
        }}
      >
        <header className="admin-section-heading">
          <p className="eyebrow">Keeper documentation</p>
          <h2>{saved ? "Edit guide" : "New guide"}</h2>
          <p>
            Save privately, preview, then explicitly publish. One complete
            language is enough.
          </p>
        </header>
        <fieldset disabled={busy} className="wiki-editor-fields">
          <div className="form-grid form-grid-two">
            <label>
              <span>
                URL slug{" "}
                <span className="wiki-required" aria-hidden="true">
                  *
                </span>
              </span>
              <input
                name="slug"
                value={slug}
                maxLength={120}
                aria-required="true"
                aria-invalid={Boolean(errors.slug)}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugEdited(true);
                  changed();
                }}
              />
              <small>
                {errors.slug ?? "Lowercase letters, numbers, and hyphens."}
              </small>
            </label>
            <label>
              <span>Module</span>
              <select
                data-field="moduleId"
                value={moduleId}
                aria-invalid={Boolean(errors.moduleId)}
                onChange={(e) => {
                  setModuleId(e.target.value);
                  changed();
                }}
              >
                <option value="">General guides</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.title}
                  </option>
                ))}
              </select>
              <small>
                {errors.moduleId ??
                  "Optional association with an existing module."}
              </small>
            </label>
            <label>
              <span>Default language</span>
              <select
                data-field="defaultLocale"
                value={content.defaultLocale}
                onChange={(e) => {
                  setContent((current) => ({
                    ...current,
                    defaultLocale: e.target.value as WikiLocale,
                  }));
                  changed();
                }}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </label>
          </div>
          <div
            className="wiki-language-tabs"
            role="group"
            aria-label="Edit guide language"
          >
            {(["en", "es"] as const).map((language) => (
              <button
                key={language}
                type="button"
                aria-pressed={locale === language}
                onClick={() => {
                  setLocale(language);
                  setPreview(null);
                }}
              >
                {language === "en" ? "English" : "Español"}
              </button>
            ))}
          </div>
          <label>
            <span>
              Title{" "}
              {locale === content.defaultLocale ? (
                <span className="wiki-required" aria-hidden="true">
                  *
                </span>
              ) : null}
            </span>
            <input
              name={`${locale}.title`}
              value={value.title}
              maxLength={180}
              aria-required={locale === content.defaultLocale}
              aria-invalid={Boolean(errors[`${locale}.title`])}
              onChange={(e) => {
                translation("title", e.target.value);
                if (!slugEdited && !saved && locale === content.defaultLocale)
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  );
              }}
            />
            <small>{errors[`${locale}.title`]}</small>
          </label>
          <label>
            <span>Summary</span>
            <input
              name={`${locale}.summary`}
              value={value.summary}
              maxLength={240}
              onChange={(e) => translation("summary", e.target.value)}
            />
            <small>{value.summary.length}/240 characters</small>
          </label>
          <MarkdownDescriptionEditor
            key={`${saved?.id ?? "new"}-${saved?.revision ?? 0}-${locale}`}
            name={`${locale}.body`}
            value={value.body}
            label="Guide text"
            required={locale === content.defaultLocale}
            onChanged={() => {}}
            onValueChanged={(body) => translation("body", body)}
            invalid={Boolean(errors[`${locale}.body`])}
          />
          <small className="wiki-field-error">{errors[`${locale}.body`]}</small>
          <p>
            Use HTTPS image links. The second language is optional; incomplete
            translations are not shown publicly.
          </p>
        </fieldset>
        <p role="status" aria-live="polite">
          {status || (dirty ? "Unsaved changes" : "Ready")}
        </p>
        <div className="wiki-editor-actions">
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={() => void showPreview()}
          >
            Preview
          </button>
          <button
            className="button button-secondary"
            type="submit"
            disabled={busy}
          >
            Save draft
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={busy}
            onClick={() => void submit("publish")}
          >
            Publish
          </button>
          {saved?.isPublished ? (
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => void submit("unpublish")}
            >
              Unpublish
            </button>
          ) : null}
        </div>
      </form>
      {preview ? (
        <section className="wiki-panel" aria-label="Guide preview">
          <GuidePresentation
            preview
            requestedLocale={locale}
            guide={{
              id: saved?.id ?? "preview",
              slug,
              content,
              module: modules.find((m) => m.id === moduleId) ?? null,
              publishedAt: new Date().toISOString(),
            }}
            document={preview}
          />
        </section>
      ) : null}
    </div>
  );
}
