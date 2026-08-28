"use client";
/* eslint-disable @next/next/no-img-element */

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogFacets, FileKind, ResourceType } from "../../lib/domain/resource";
import type { ResourceInput } from "../../lib/validation/resource";
import { WIZARD_STEPS, wizardSlug, type WizardCheck } from "../../lib/services/resource-wizard";
import { ModuleReleaseManager } from "./ModuleReleaseManager";
import type { EditingResource } from "./types";

type Tier = { id: string; title: string; amountCents: number; isPublished: boolean };
type ArtworkKind = "cover" | "thumbnail" | "icon";
type UploadState = { phase: "idle" | "uploading" | "saving" | "complete" | "error"; progress: number; fileName?: string; error?: string };

const TYPES: Array<{ id: ResourceType; title: string; detail: string }> = [
  { id: "module", title: "Foundry module", detail: "Installable ZIP with a stable Foundry manifest." },
  { id: "pdf", title: "PDF", detail: "A downloadable guide, supplement, or document." },
  { id: "macro", title: "Macro", detail: "A Foundry JS or JSON automation." },
  { id: "class", title: "Class", detail: "A complete character class entry." },
  { id: "subclass", title: "Subclass", detail: "A character subclass or specialization." },
];

export function ResourceCreationWizard({
  initialValue,
  facets,
  tiers,
}: {
  initialValue?: EditingResource;
  facets: CatalogFacets;
  tiers: Tier[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialValue?.setupStep ?? 1);
  const [draft, setDraft] = useState<ResourceInput>(() => initialValue ?? emptyWizardValue(facets));
  const [resource, setResource] = useState(initialValue);
  const [status, setStatus] = useState(initialValue ? "Draft restored." : "Choose what you want to add.");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<WizardCheck[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [showSecondLanguage, setShowSecondLanguage] = useState(false);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const temporaryUrls = useRef<string[]>([]);

  useEffect(() => {
    const urls = temporaryUrls.current;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [dirty]);

  useEffect(() => {
    if (!resource) return;
    let cancelled = false;
    fetch(`/api/resources/${resource.id}/wizard`)
      .then(async (response) => ({
        ok: response.ok,
        body: (await response.json()) as { checks?: WizardCheck[] },
      }))
      .then(({ ok, body }) => {
        if (!cancelled && ok) setChecks(body.checks ?? []);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [resource]);

  const primaryLocale = draft.defaultLocale;
  const secondaryLocale = primaryLocale === "en" ? "es" : "en";
  const visibleTags = useMemo(
    () => facets.tags.filter((tag) => tag.name.toLowerCase().includes(tagQuery.toLowerCase())),
    [facets.tags, tagQuery],
  );

  function change<K extends keyof ResourceInput>(key: K, value: ResourceInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function changeTranslation(locale: "en" | "es", key: "title" | "shortDescription" | "description", value: string) {
    setDraft((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: { ...current.translations[locale], [key]: value },
      },
    }));
    setDirty(true);
  }

  async function createDraft() {
    setBusy(true);
    setStatus("Creating your draft…");
    const response = await fetch("/api/resources/wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        slug: draft.slug,
        resourceType: draft.resourceType,
        defaultLocale: draft.defaultLocale,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string; errors?: Record<string, string> };
    setBusy(false);
    if (!response.ok || !body.id) {
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
    const response = await fetch(`/api/resources/${resource.id}/wizard`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: normalizedDraft(draft), step: nextStep }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; errors?: Record<string, string>; checks?: WizardCheck[] };
    setBusy(false);
    if (!response.ok) {
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
    if (publish && !window.confirm("Publish this resource now? It will become visible immediately.")) return;
    setBusy(true);
    setStatus(publish ? "Publishing…" : "Finishing draft…");
    const response = await fetch(`/api/resources/${resource.id}/wizard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: normalizedDraft(draft), publish }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; errors?: Record<string, string>; checks?: WizardCheck[] };
    setBusy(false);
    if (!response.ok) {
      setChecks(body.checks ?? checks);
      showErrors(body.errors, body.error ?? "The resource could not be completed.");
      return;
    }
    setDirty(false);
    router.push(`/admin/resources/${resource.id}`);
    router.refresh();
  }

  function showErrors(nextErrors: Record<string, string> | undefined, fallback: string) {
    const values = nextErrors ?? {};
    setErrors(values);
    setStatus(Object.values(values).find(Boolean) ?? fallback);
    const first = Object.keys(values)[0];
    if (first) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
  }

  async function uploadFile(kind: FileKind, file: File) {
    if (!resource?.resourceVersionId) return;
    const key = kind;
    const isArtwork = kind === "cover" || kind === "thumbnail" || kind === "icon";
    if (isArtwork) {
      const localUrl = URL.createObjectURL(file);
      temporaryUrls.current.push(localUrl);
      setResource((current) => current ? { ...current, [`${kind}Url`]: localUrl } : current);
    }
    setUploads((current) => ({ ...current, [key]: { phase: "uploading", progress: 1, fileName: file.name } }));
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
      const pathname = isArtwork
        ? `resource-artwork/${resource.id}/${kind}/${Date.now()}-${safeName}`
        : `resource-files/${resource.resourceVersionId}/${Date.now()}-${safeName}`;
      const blob = await upload(pathname, file, {
        access: isArtwork || kind === "descriptionImage" ? "public" : "private",
        handleUploadUrl: "/api/uploads",
        multipart: file.size > 20 * 1024 * 1024,
        clientPayload: JSON.stringify({
          resourceVersionId: resource.resourceVersionId,
          resourceId: isArtwork ? resource.id : undefined,
          kind,
          locale: primaryLocale,
          originalName: file.name,
          mimeType: file.type || mimeForFile(file.name),
          sizeBytes: file.size,
          uploadedBy: "shared-admin",
        }),
        onUploadProgress(event) {
          setUploads((current) => ({ ...current, [key]: { ...current[key], phase: "uploading", progress: Math.max(1, Math.round(event.percentage)) } }));
        },
      });
      if (isArtwork) {
        setUploads((current) => ({ ...current, [key]: { ...current[key], phase: "saving", progress: 100 } }));
        const response = await fetch("/api/uploads/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId: resource.id, kind, locale: "en", originalName: file.name, mimeType: file.type || mimeForFile(file.name), sizeBytes: file.size, url: blob.url, pathname: blob.pathname }),
        });
        const finalized = (await response.json()) as { error?: string; coverUrl?: string | null; thumbnailUrl?: string | null; iconUrl?: string | null };
        if (!response.ok) throw new Error(finalized.error ?? "The image could not be saved.");
        setResource((current) => current ? { ...current, coverUrl: finalized.coverUrl ?? current.coverUrl, thumbnailUrl: finalized.thumbnailUrl ?? current.thumbnailUrl, iconUrl: finalized.iconUrl ?? current.iconUrl } : current);
      }
      setUploads((current) => ({ ...current, [key]: { ...current[key], phase: "complete", progress: 100 } }));
      setStatus(`${file.name} saved.`);
      if (kind === "descriptionImage") {
        changeTranslation(primaryLocale, "description", `${draft.translations[primaryLocale].description}\n\n![${file.name}](${blob.url})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setUploads((current) => ({ ...current, [key]: { ...current[key], phase: "error", progress: 0, error: message } }));
      setStatus(message);
    }
  }

  return (
    <div className="creation-wizard">
      <header className="wizard-header">
        <div><p className="eyebrow">Guided setup</p><h1>{resource ? draft.title : "Add content"}</h1><p>{status}</p></div>
        <ol className="wizard-stepper" aria-label="Content creation progress">
          {WIZARD_STEPS.map((label, index) => {
            const number = index + 1;
            return <li key={label} className={number === step ? "current" : number < step ? "complete" : ""} aria-current={number === step ? "step" : undefined}><span>{number < step ? "✓" : number}</span><small>{label}</small></li>;
          })}
        </ol>
      </header>

      <main className="wizard-card">
        {step === 1 ? <ChooseStep draft={draft} errors={errors} onChange={change} /> : null}
        {step === 2 ? <DescribeStep draft={draft} errors={errors} primary={primaryLocale} secondary={secondaryLocale} showSecond={showSecondLanguage} setShowSecond={setShowSecondLanguage} changeTranslation={changeTranslation} upload={(file) => uploadFile("descriptionImage", file)} uploadState={uploads.descriptionImage} /> : null}
        {step === 3 ? <OrganizeStep draft={draft} facets={facets} errors={errors} tagQuery={tagQuery} setTagQuery={setTagQuery} visibleTags={visibleTags} onChange={change} /> : null}
        {step === 4 && resource ? <ReleaseStep draft={draft} resource={resource} uploads={uploads} onChange={change} uploadFile={uploadFile} /> : null}
        {step === 5 ? <AccessStep draft={draft} tiers={tiers} errors={errors} onChange={change} /> : null}
        {step === 6 && resource ? <ReviewStep resource={resource} checks={checks} /> : null}
      </main>

      <footer className="wizard-actions">
        <button type="button" className="button button-secondary" disabled={busy || step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>Back</button>
        <span aria-live="polite">{busy ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}</span>
        <div>
          {step === 1 ? <button type="button" className="button button-primary" disabled={busy} onClick={() => void createDraft()}>Continue</button> : null}
          {step > 1 && step < 6 ? <button type="button" className="button button-primary" disabled={busy || Object.values(uploads).some((item) => item.phase === "uploading" || item.phase === "saving")} onClick={() => void saveStep(step + 1)}>Save and continue</button> : null}
          {step === 6 ? <><button type="button" className="button button-secondary" disabled={busy} onClick={() => void finish(false)}>Save as draft</button><button type="button" className="button button-primary" disabled={busy || checks.some((item) => item.level === "required")} onClick={() => void finish(true)}>Publish</button></> : null}
        </div>
      </footer>
    </div>
  );
}

function ChooseStep({ draft, errors, onChange }: StepProps) {
  return <section><Heading number="01" title="What are you adding?" text="Choose the closest content type. The next steps will adapt automatically." /><div className="wizard-type-grid">{TYPES.map((type) => <label key={type.id} className={draft.resourceType === type.id ? "selected" : ""}><input type="radio" name="resourceType" checked={draft.resourceType === type.id} onChange={() => onChange("resourceType", type.id)} /><strong>{type.title}</strong><span>{type.detail}</span></label>)}</div><div className="form-grid form-grid-two"><WizardInput label="Internal title" name="title" value={draft.title} error={errors.title} onChange={(value) => { onChange("title", value); onChange("slug", wizardSlug(value)); const locale = draft.defaultLocale; onChange("translations", { ...draft.translations, [locale]: { ...draft.translations[locale], title: value } }); }} /><label><span>Default language</span><select value={draft.defaultLocale} onChange={(event) => onChange("defaultLocale", event.target.value as "en" | "es")}><option value="en">English</option><option value="es">Spanish</option></select></label></div><details className="wizard-advanced"><summary>Advanced URL settings</summary><WizardInput label="URL slug" name="slug" value={draft.slug} error={errors.slug} onChange={(value) => onChange("slug", wizardSlug(value))} /></details></section>;
}

function DescribeStep({ draft, errors, primary, secondary, showSecond, setShowSecond, changeTranslation, upload, uploadState }: { draft: ResourceInput; errors: Record<string,string>; primary:"en"|"es"; secondary:"en"|"es"; showSecond:boolean; setShowSecond:(value:boolean)=>void; changeTranslation:(locale:"en"|"es", key:"title"|"shortDescription"|"description", value:string)=>void; upload:(file:File)=>void; uploadState?:UploadState }) {
  const fields = (locale:"en"|"es") => <div className="wizard-language-fields"><WizardInput label={locale === "en" ? "English title" : "Título en español"} name={`${locale}Title`} value={draft.translations[locale].title} error={errors[`${locale}Title`]} onChange={(value)=>changeTranslation(locale,"title",value)} /><label><span>Short description</span><textarea name={`${locale}ShortDescription`} maxLength={240} value={draft.translations[locale].shortDescription} onChange={(event)=>changeTranslation(locale,"shortDescription",event.target.value)} /><small>{draft.translations[locale].shortDescription.length}/240 characters</small></label><label><span>Full description</span><textarea name={`${locale}Description`} className="wizard-description" value={draft.translations[locale].description} onChange={(event)=>changeTranslation(locale,"description",event.target.value)} /><small>Markdown formatting is supported.</small></label>{locale === primary ? <UploadButton label="Add description image" accept="image/png,image/jpeg,image/webp,image/gif" state={uploadState} onFile={upload} /> : null}</div>;
  return <section><Heading number="02" title="Describe the content" text="Write the information visitors should see on the public page." />{fields(primary)}<label className="wizard-secondary-toggle"><input type="checkbox" checked={showSecond} onChange={(event)=>setShowSecond(event.target.checked)} /> Add {secondary === "en" ? "English" : "Spanish"} translation</label>{showSecond ? fields(secondary) : null}</section>;
}

function OrganizeStep({ draft, facets, errors, tagQuery, setTagQuery, visibleTags, onChange }: StepProps & { facets:CatalogFacets; tagQuery:string; setTagQuery:(value:string)=>void; visibleTags:CatalogFacets["tags"] }) {
  return <section><Heading number="03" title="Help people find it" text="We selected sensible defaults. Adjust only what this resource needs." /><div className="form-grid form-grid-three"><WizardSelect label="Category" value={draft.categoryId} options={facets.categories} onChange={(value)=>onChange("categoryId",value)} /><WizardSelect label="Game system" value={draft.gameSystemId} options={facets.gameSystems} onChange={(value)=>onChange("gameSystemId",value)} /><WizardSelect label="Author" value={draft.authorId} options={facets.authors} onChange={(value)=>onChange("authorId",value)} /></div>{draft.resourceType === "class" ? <WizardInput label="Class name" name="className" value={draft.className ?? ""} error={errors.className} onChange={(value)=>onChange("className",value)} /> : null}{draft.resourceType === "subclass" ? <div className="form-grid form-grid-two"><WizardInput label="Parent class" name="className" value={draft.className ?? ""} onChange={(value)=>onChange("className",value)} /><WizardInput label="Subclass name" name="subclassName" value={draft.subclassName ?? ""} onChange={(value)=>onChange("subclassName",value)} /></div> : null}<label><span>Search tags</span><input value={tagQuery} onChange={(event)=>setTagQuery(event.target.value)} placeholder="Search tags…" /></label><div className="wizard-tag-grid">{visibleTags.map((tag)=><label key={tag.id} className={draft.tagIds.includes(tag.id)?"selected":""}><input type="checkbox" checked={draft.tagIds.includes(tag.id)} onChange={(event)=>onChange("tagIds",event.target.checked?[...draft.tagIds,tag.id]:draft.tagIds.filter((id)=>id!==tag.id))} />{tag.name}</label>)}</div></section>;
}

function ReleaseStep({ draft, resource, uploads, onChange, uploadFile }: { draft:ResourceInput; resource:EditingResource; uploads:Record<string,UploadState>; onChange:StepProps["onChange"]; uploadFile:(kind:FileKind,file:File)=>Promise<void> }) {
  const primaryKind: FileKind = draft.resourceType === "macro" ? "macro" : "pdf";
  return <section><Heading number="04" title="Add the release" text="Upload the content people will receive, then add optional artwork." />{draft.resourceType === "module" ? <ModuleReleaseManager resourceId={resource.id} accessMode={draft.accessMode} /> : <div className="wizard-primary-upload"><UploadButton label={draft.resourceType === "macro" ? "Upload macro (JS or JSON)" : draft.resourceType === "pdf" ? "Upload PDF" : "Optional supporting PDF"} accept={draft.resourceType === "macro" ? ".js,.json" : ".pdf"} state={uploads[primaryKind]} onFile={(file)=>void uploadFile(primaryKind,file)} /></div>}{draft.resourceType !== "module" ? <div className="form-grid form-grid-two"><WizardInput label="Version" name="currentVersion" value={draft.currentVersion} onChange={(value)=>onChange("currentVersion",value)} /><label><span>Compatibility</span><select value={draft.compatibilityStatus} onChange={(event)=>onChange("compatibilityStatus",event.target.value as ResourceInput["compatibilityStatus"])}>{["verified","compatible","untested","outdated","unsupported"].map((value)=><option key={value} value={value}>{value}</option>)}</select></label></div> : null}<h3>Optional artwork</h3><div className="wizard-artwork-grid">{(["icon","cover","thumbnail"] as ArtworkKind[]).map((kind)=><div key={kind}>{resource[`${kind}Url`] ? <img src={resource[`${kind}Url`] ?? ""} alt="" /> : null}<UploadButton label={kind === "icon" ? "Resource icon" : kind === "cover" ? "Cover image" : "Card thumbnail"} accept="image/png,image/jpeg,image/webp" state={uploads[kind]} onFile={(file)=>void uploadFile(kind,file)} /></div>)}</div><label className="wizard-secondary-toggle"><input type="checkbox" checked={draft.useIconEverywhere} disabled={!resource.iconUrl && uploads.icon?.phase !== "complete"} onChange={(event)=>onChange("useIconEverywhere",event.target.checked)} /> Use the resource icon everywhere</label></section>;
}

function AccessStep({ draft, tiers, errors, onChange }: StepProps & { tiers:Tier[] }) {
  return <section><Heading number="05" title="Choose who can access it" text="One clear choice controls both access and the catalog price label." /><div className="wizard-access-grid"><label className={draft.accessMode === "public" ? "selected" : ""}><input type="radio" checked={draft.accessMode === "public"} onChange={()=>{onChange("accessMode","public");onChange("pricing","free");}} /><strong>Free and public</strong><span>Anyone can access the published content.</span></label><label className={draft.accessMode === "patreon" ? "selected" : ""}><input type="radio" checked={draft.accessMode === "patreon"} onChange={()=>{onChange("accessMode","patreon");onChange("pricing","premium");}} /><strong>Patreon members</strong><span>Only selected active tiers can access it.</span></label></div>{draft.resourceType === "module" && draft.accessMode === "patreon" ? <div className="wizard-warning">Paid Foundry module distribution is not supported yet. You can save this setup as a draft, but it cannot be published.</div> : null}{draft.accessMode === "patreon" ? <fieldset><legend>Qualifying Patreon tiers</legend><div className="wizard-tier-grid">{tiers.filter((tier)=>tier.isPublished).map((tier)=><label key={tier.id} className={draft.patreonTierIds.includes(tier.id)?"selected":""}><input type="checkbox" checked={draft.patreonTierIds.includes(tier.id)} onChange={(event)=>onChange("patreonTierIds",event.target.checked?[...draft.patreonTierIds,tier.id]:draft.patreonTierIds.filter((id)=>id!==tier.id))} /><strong>{tier.title}</strong><span>${(tier.amountCents/100).toFixed(2)} / month</span></label>)}</div>{errors.patreonTierIds ? <small className="field-error">{errors.patreonTierIds}</small> : null}</fieldset> : null}<details className="wizard-advanced"><summary>Advanced publishing details</summary><div className="form-grid form-grid-two"><WizardInput label="Project URL" name="projectUrl" value={draft.projectUrl ?? ""} onChange={(value)=>onChange("projectUrl",value)} /><WizardInput label="License" name="licenseName" value={draft.licenseName ?? ""} onChange={(value)=>onChange("licenseName",value)} /></div><label className="wizard-secondary-toggle"><input type="checkbox" checked={draft.isFeatured} onChange={(event)=>onChange("isFeatured",event.target.checked)} /> Feature this resource on the home page</label></details></section>;
}

function ReviewStep({ resource, checks }: { resource:EditingResource; checks:WizardCheck[] }) {
  return <section><Heading number="06" title="Review before finishing" text="Required items block publication. Recommendations can be completed later." /><div className="wizard-check-columns">{(["required","recommended","confirmed"] as const).map((level)=><div key={level} className={`wizard-check-list ${level}`}><h3>{level === "required" ? "Required corrections" : level === "recommended" ? "Optional recommendations" : "Confirmed"}</h3>{checks.filter((item)=>item.level===level).map((item)=><p key={`${item.step}-${item.message}`}><span>{level === "confirmed" ? "✓" : level === "required" ? "!" : "•"}</span>{item.message}</p>)}{!checks.some((item)=>item.level===level)?<p>None.</p>:null}</div>)}</div><div className="wizard-preview"><iframe title="Resource preview" src={`/admin/resources/${resource.id}/preview`} /></div></section>;
}

type StepProps = { draft:ResourceInput; errors:Record<string,string>; onChange:<K extends keyof ResourceInput>(key:K,value:ResourceInput[K])=>void };
function Heading({number,title,text}:{number:string;title:string;text:string}){return <div className="wizard-section-heading"><span>{number}</span><div><h2>{title}</h2><p>{text}</p></div></div>}
function WizardInput({label,name,value,error,onChange}:{label:string;name:string;value:string;error?:string;onChange:(value:string)=>void}){return <label><span>{label}</span><input name={name} value={value} aria-invalid={Boolean(error)} aria-describedby={error?`${name}-error`:undefined} onChange={(event)=>onChange(event.target.value)} />{error?<small id={`${name}-error`} className="field-error">{error}</small>:null}</label>}
function WizardSelect({label,value,options,onChange}:{label:string;value:string;options:Array<{id:string;name:string}>;onChange:(value:string)=>void}){return <label><span>{label}</span><select value={value} onChange={(event)=>onChange(event.target.value)}>{options.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
function UploadButton({label,accept,state,onFile}:{label:string;accept:string;state?:UploadState;onFile:(file:File)=>void}){const active=state?.phase==="uploading"||state?.phase==="saving";return <label className={`wizard-upload ${state?.phase??"idle"}`}><strong>{label}</strong><span>{state?.phase==="complete"?"Saved":state?.phase==="saving"?"Saving…":state?.phase==="uploading"?`${state.progress}%`:state?.error??"Choose a file"}</span><input type="file" accept={accept} disabled={active} onChange={(event)=>{const file=event.target.files?.[0];if(file)onFile(file);event.target.value="";}} />{active?<span className="upload-progress" role="progressbar" aria-valuenow={state?.progress} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${state?.progress??0}%`}} /></span>:null}</label>}

function emptyWizardValue(facets:CatalogFacets):ResourceInput{return {title:"",slug:"",shortDescription:"",description:"",resourceType:"module",categoryId:facets.categories[0]?.id??"",authorId:facets.authors[0]?.id??"",gameSystemId:facets.gameSystems[0]?.id??"",currentVersion:"1.0.0",compatibilityStatus:"untested",pricing:"free",tagIds:[],dependencies:[],defaultLocale:"en",accessMode:"public",patreonTierIds:[],translations:{en:{title:"",shortDescription:"",description:"",isPublished:false},es:{title:"",shortDescription:"",description:"",isPublished:false}},isFeatured:false,useIconEverywhere:false,isPublished:false}}
function normalizedDraft(value:ResourceInput):ResourceInput{const primary=value.translations[value.defaultLocale];return {...value,title:value.title||primary.title,shortDescription:primary.shortDescription,description:primary.description,pricing:value.accessMode==="public"?"free":"premium",translations:{en:{...value.translations.en,isPublished:value.defaultLocale==="en"},es:{...value.translations.es,isPublished:value.defaultLocale==="es"}},isPublished:false}}
function mimeForFile(name:string){const extension=name.split(".").pop()?.toLowerCase();return extension==="pdf"?"application/pdf":extension==="js"?"text/javascript":extension==="json"?"application/json":extension==="png"?"image/png":extension==="webp"?"image/webp":"image/jpeg"}
