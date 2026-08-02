import type { Metadata } from "next";
import Link from "next/link";
import { MarkdownContent } from "../../../../../components/resources/MarkdownContent";
import { notFound, redirect } from "next/navigation";
import {
  getAdminResource,
} from "../../../../../lib/repositories/resource-repository";
import { requireAdminPage } from "../../../../../lib/services/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Draft preview",
  robots: { index: false, follow: false },
};

export default async function ResourcePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  if (!(await requireAdminPage())) redirect("/admin/login");
  const { id } = await params;
  const query = await searchParams;
  const resource = await getAdminResource(id).catch(() => null);
  if (!resource) notFound();
  const locale = query.lang === "es" ? "es" : "en";
  const translation =
    resource.translations[locale].title.trim()
      ? resource.translations[locale]
      : resource.translations[resource.defaultLocale];

  return (
    <article className="section page-section admin-preview-page">
      <div className="container narrow-container">
        <div className="admin-preview-banner">
          <span>Private draft preview</span>
          <div>
            <Link href={`/admin/resources/${id}/preview?lang=en`}>English</Link>
            <Link href={`/admin/resources/${id}/preview?lang=es`}>Español</Link>
            <Link href={`/admin/resources/${id}`}>Return to editor</Link>
          </div>
        </div>
        <p className="eyebrow">
          {resource.resourceType} · v{resource.currentVersion}
        </p>
        <h1>{translation.title || resource.title}</h1>
        <p className="resource-lead">{translation.shortDescription}</p>
        <div className="resource-hero-status">
          <span>{resource.compatibilityStatus}</span>
          <span>
            {resource.accessMode === "patreon"
              ? "Patreon protected"
              : "Public download"}
          </span>
          <span>{translation.isPublished ? "Translation ready" : "Translation draft"}</span>
        </div>
        <section className="content-section">
          <h2>About</h2>
          <MarkdownContent
            markdown={translation.description || "No description has been added yet."}
          />
        </section>
        {translation.installationInstructions ? (
          <section className="content-section">
            <h2>Installation instructions</h2>
            <p>{translation.installationInstructions}</p>
          </section>
        ) : null}
      </div>
    </article>
  );
}
