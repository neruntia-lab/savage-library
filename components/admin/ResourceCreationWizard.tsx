"use client";

import { fetchApi } from "../../lib/client/request";
import { requestJson } from "../../lib/client/request";
import { useResourceUploads } from "./useResourceUploads";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CatalogFacets, FileKind } from "../../lib/domain/resource";
import type { ResourceInput } from "../../lib/validation/resource";
import {
  WIZARD_STEPS,
  wizardStepErrors,
  type WizardCheck,
} from "../../lib/services/resource-wizard";
import {
  ChooseStep,
  DescribeStep,
  OrganizeStep,
  ReleaseStep,
  AccessStep,
  ReviewStep,
  emptyWizardValue,
  normalizedDraft,
} from "./WizardSteps";
import type { EditingResource } from "./types";

type Tier = {
  id: string;
  title: string;
  amountCents: number;
  isPublished: boolean;
};
export function ResourceCreationWizard({
  initialValue,
  facets,
  tiers,
  initialChecks = [],
}: {
  initialValue?: EditingResource;
  facets: CatalogFacets;
  tiers: Tier[];
  initialChecks?: WizardCheck[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialValue?.setupStep ?? 1);
  const [draft, setDraft] = useState<ResourceInput>(
    () => initialValue ?? emptyWizardValue(facets),
  );
  const [resource, setResource] = useState(initialValue);
  const [status, setStatus] = useState(
    initialValue ? "Draft restored." : "Choose what you want to add.",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<WizardCheck[]>(initialChecks);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [showSecondLanguage, setShowSecondLanguage] = useState(false);
  const fileUploads = useResourceUploads({
    resourceId: resource?.id,
    resourceVersionId: resource?.resourceVersionId,
    onStatus: setStatus,
    onPreview: (kind, url) =>
      setResource((current) =>
        current ? { ...current, [`${kind}Url`]: url } : current,
      ),
    onArtwork: (confirmed, kind) =>
      setResource((current) =>
        current
          ? { ...current, [`${kind}Url`]: confirmed[`${kind}Url`] }
          : current,
      ),
  });
  const uploads = {
    ...fileUploads.uploads,
    descriptionImage:
      fileUploads.uploads[`${draft.defaultLocale}-descriptionImage`],
    pdf: fileUploads.uploads[`${draft.defaultLocale}-pdf`],
    macro: fileUploads.uploads[`${draft.defaultLocale}-macro`],
  };

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty]);

  useEffect(() => {
    if (!resource) return;
    let cancelled = false;
    fetchApi(`/api/resources/${resource.id}/wizard`)
      .then(async (response) => ({
        ok: response.ok,
        body: (await response.json()) as { checks?: WizardCheck[] },
      }))
      .then(({ ok, body }) => {
        if (!cancelled && ok) setChecks(body.checks ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [resource]);

  const primaryLocale = draft.defaultLocale;
  const secondaryLocale = primaryLocale === "en" ? "es" : "en";
  const visibleTags = useMemo(
    () =>
      facets.tags.filter((tag) =>
        tag.name.toLowerCase().includes(tagQuery.toLowerCase()),
      ),
    [facets.tags, tagQuery],
  );

  function change<K extends keyof ResourceInput>(
    key: K,
    value: ResourceInput[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setStatus("Unsaved changes");
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function changeTranslation(
    locale: "en" | "es",
    key: "title" | "shortDescription" | "description",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: { ...current.translations[locale], [key]: value },
      },
    }));
    setDirty(true);
    setStatus("Unsaved changes");
    const errorKey = `${locale}${key[0].toUpperCase()}${key.slice(1)}`;
    setErrors((current) => ({ ...current, [errorKey]: "" }));
  }

  async function createDraft() {
    const identityErrors = wizardStepErrors(draft, 1, {
      hasPrimaryFile: false,
      hasValidatedModuleRelease: false,
    });
    if (Object.keys(identityErrors).length) {
      showErrors(identityErrors, "Complete the required fields.");
      return;
    }
    setBusy(true);
    setStatus("Creating your draft…");
    const { ok, body } = await requestJson<{
      id?: string;
      error?: string;
      errors?: Record<string, string>;
      checks?: WizardCheck[];
    }>("/api/resources/wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        slug: draft.slug,
        resourceType: draft.resourceType,
        defaultLocale: draft.defaultLocale,
      }),
    });
    setBusy(false);
    if (!ok || !body.id) {
      showErrors(body.errors, body.error ?? "The draft could not be created.");
      return;
    }
    setDirty(false);
    router.replace(`/admin/resources/${body.id}/setup`);
    router.refresh();
  }

  async function saveStep(nextStep: number) {
    if (!resource) return;
    setBusy(true);
    setStatus("Saving this step…");
    const { ok, body } = await requestJson<{
      id?: string;
      error?: string;
      errors?: Record<string, string>;
      checks?: WizardCheck[];
    }>(`/api/resources/${resource.id}/wizard`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: normalizedDraft(draft),
        step: nextStep,
      }),
    });
    setBusy(false);
    if (!ok) {
      showErrors(body.errors, body.error ?? "This step could not be saved.");
      return;
    }
    setErrors({});
    setChecks(body.checks ?? checks);
    setDirty(false);
    setStep(nextStep);
    setStatus("Saved.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finish(publish: boolean) {
    if (!resource) return;
    if (
      publish &&
      !window.confirm(
        "Publish this resource now? It will become visible immediately.",
      )
    )
      return;
    setBusy(true);
    setStatus(publish ? "Publishing…" : "Finishing draft…");
    const { ok, body } = await requestJson<{
      id?: string;
      error?: string;
      errors?: Record<string, string>;
      checks?: WizardCheck[];
    }>(`/api/resources/${resource.id}/wizard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: normalizedDraft(draft), publish }),
    });
    setBusy(false);
    if (!ok) {
      setChecks(body.checks ?? checks);
      showErrors(
        body.errors,
        body.error ?? "The resource could not be completed.",
      );
      return;
    }
    setDirty(false);
    router.push(`/admin/resources/${resource.id}`);
    router.refresh();
  }

  function showErrors(
    nextErrors: Record<string, string> | undefined,
    fallback: string,
  ) {
    const values = nextErrors ?? {};
    setErrors(values);
    setStatus(Object.values(values).find(Boolean) ?? fallback);
    const first = Object.keys(values)[0];
    if (first)
      requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(
          `[name="${first}"], [data-error-key="${first}"]`,
        );
        target?.focus();
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
  }

  async function uploadFile(kind: FileKind, file: File) {
    const url = await fileUploads.uploadFile(kind, file, primaryLocale);
    if (!url) return;
    setErrors((current) => ({ ...current, [kind]: "" }));
    if (kind === "descriptionImage") {
      // Functional state keeps text typed during an upload rather than replacing it with an old snapshot.
      setDraft((current) => ({
        ...current,
        translations: {
          ...current.translations,
          [primaryLocale]: {
            ...current.translations[primaryLocale],
            description:
              current.translations[primaryLocale].description +
              `\n\n![${file.name}](${url})`,
          },
        },
      }));
      setDirty(true);
    }
  }
  const uploadBusy = fileUploads.busy;

  return (
    <div className="admin-workspace wizard-workspace">
      <aside className="admin-editor-nav wizard-progress-nav">
        <Link href="/admin" className="admin-back-link">
          ← Content library
        </Link>
        <p className="eyebrow">Guided setup</p>
        <h1>{resource ? draft.title : "Add content"}</h1>
        <nav aria-label="Content creation progress">
          <ol className="wizard-stepper">
            {WIZARD_STEPS.map((label, index) => {
              const number = index + 1;
              return (
                <li
                  key={label}
                  className={
                    number === step
                      ? "current"
                      : number < step
                        ? "complete"
                        : ""
                  }
                  aria-current={number === step ? "step" : undefined}
                >
                  <span>{number < step ? "✓" : number}</span>
                  <small>{label}</small>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="admin-save-state" aria-live="polite">
          <span className={!busy && !dirty ? "saved" : ""} />
          {status}
        </div>
      </aside>

      <div className="admin-workspace-form wizard-form">
        <div
          className="wizard-mobile-progress"
          aria-label={`Step ${step} of ${WIZARD_STEPS.length}: ${WIZARD_STEPS[step - 1]}`}
        >
          <span>
            Step {step} of {WIZARD_STEPS.length}
          </span>
          <strong>{WIZARD_STEPS[step - 1]}</strong>
          <i>
            <b style={{ width: `${(step / WIZARD_STEPS.length) * 100}%` }} />
          </i>
        </div>
        {step === 1 ? (
          <ChooseStep draft={draft} errors={errors} onChange={change} />
        ) : null}
        {step === 2 ? (
          <DescribeStep
            draft={draft}
            errors={errors}
            primary={primaryLocale}
            secondary={secondaryLocale}
            showSecond={showSecondLanguage}
            setShowSecond={setShowSecondLanguage}
            changeTranslation={changeTranslation}
            upload={(file) => uploadFile("descriptionImage", file)}
            uploadState={uploads.descriptionImage}
          />
        ) : null}
        {step === 3 ? (
          <OrganizeStep
            draft={draft}
            facets={facets}
            errors={errors}
            tagQuery={tagQuery}
            setTagQuery={setTagQuery}
            visibleTags={visibleTags}
            onChange={change}
          />
        ) : null}
        {step === 4 && resource ? (
          <ReleaseStep
            draft={draft}
            resource={resource}
            uploads={uploads}
            errors={errors}
            onChange={change}
            uploadFile={uploadFile}
          />
        ) : null}
        {step === 5 ? (
          <AccessStep
            draft={draft}
            tiers={tiers}
            errors={errors}
            onChange={change}
          />
        ) : null}
        {step === 6 && resource ? (
          <ReviewStep resource={resource} checks={checks} />
        ) : null}
        <div className="admin-editor-actions wizard-actions">
          <span aria-live="polite">{status}</span>
          <div>
            {step > 1 ? (
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
                onClick={() => setStep((current) => Math.max(1, current - 1))}
              >
                Back
              </button>
            ) : null}
            {step === 1 ? (
              <button
                type="button"
                className="button button-primary"
                disabled={busy}
                onClick={() => void createDraft()}
              >
                Continue
              </button>
            ) : null}
            {step > 1 && step < 6 ? (
              <button
                type="button"
                className="button button-primary"
                disabled={busy || uploadBusy}
                onClick={() => void saveStep(step + 1)}
              >
                Save and continue
              </button>
            ) : null}
            {step === 6 ? (
              <>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => void finish(false)}
                >
                  Save as draft
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={
                    busy || checks.some((item) => item.level === "required")
                  }
                  onClick={() => void finish(true)}
                >
                  Publish
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
