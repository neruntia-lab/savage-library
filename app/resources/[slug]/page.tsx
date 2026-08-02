import type { Metadata } from "next";
import Link from "next/link";
import { MarkdownContent } from "../../../components/resources/MarkdownContent";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CompatibilityBadge } from "../../../components/resources/CompatibilityBadge";
import { ResourceGrid } from "../../../components/resources/ResourceGrid";
import { CopyButton } from "../../../components/ui/CopyButton";
import { ROUTES } from "../../../lib/config/site";
import { formatBytes, formatDate } from "../../../lib/format";
import { getResourceBySlug } from "../../../lib/repositories/resource-repository";

type ResourcePageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lang?: string; patreon?: string }>;
};

export async function generateMetadata({
  params,
}: ResourcePageProps): Promise<Metadata> {
  const { slug } = await params;
  const resource = await getResourceBySlug(slug);
  return resource
    ? {
        title: resource.title,
        description: resource.shortDescription,
        openGraph: {
          title: resource.title,
          description: resource.shortDescription,
          type: "article",
        },
      }
    : {};
}

export default async function ResourcePage({
  params,
  searchParams,
}: ResourcePageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const locale = query?.lang === "es" ? "es" : "en";
  const resource = await getResourceBySlug(slug, locale);
  if (!resource) notFound();

  return (
    <article className="section page-section">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href={ROUTES.library}>Library</Link>
          <span aria-hidden="true">/</span>
          <Link href={ROUTES.category(resource.category.slug)}>
            {resource.category.name}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{resource.title}</span>
        </nav>

        <div className="resource-hero">
          <div className="resource-cover">
            <Image
              src={resource.coverUrl ?? "/logo.png"}
              alt={`${resource.title} cover`}
              width={220}
              height={220}
              priority
            />
          </div>
          <div>
            <div className="resource-kicker">
              <span>{resource.category.name}</span>
              <span aria-hidden="true">·</span>
              <span>{resource.gameSystem.name}</span>
            </div>
            <h1>{resource.title}</h1>
            <p className="resource-lead">{resource.shortDescription}</p>
            <div className="resource-hero-status">
              <CompatibilityBadge status={resource.compatibilityStatus} />
              {resource.accessMode === "patreon" ? (
                <span className="patreon-badge">Patreon access</span>
              ) : null}
              <span>
                Version <strong>{resource.currentVersion}</strong>
              </span>
              <span>{resource.pricing === "free" ? "Free" : resource.priceLabel ?? "Premium"}</span>
            </div>
            <div className="resource-actions">
              {resource.files[0] ? (
                <Link
                  className="button button-primary"
                  href={ROUTES.download(resource.files[0].id)}
                >
                  Download {resource.files[0].kind.toUpperCase()}
                </Link>
              ) : resource.projectUrl ? (
                <a
                  className="button button-primary"
                  href={resource.projectUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  View project
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {resource.availableLocales && resource.availableLocales.length > 1 ? (
          <nav className="resource-language-switcher" aria-label="Resource language">
            <span>Language</span>
            <Link
              className={resource.activeLocale === "en" ? "active" : ""}
              href={`${ROUTES.resource(resource.slug)}?lang=en`}
            >
              English
            </Link>
            <Link
              className={resource.activeLocale === "es" ? "active" : ""}
              href={`${ROUTES.resource(resource.slug)}?lang=es`}
            >
              Español
            </Link>
          </nav>
        ) : null}

        {resource.accessMode === "patreon" ? (
          <section
            className={`patreon-access-panel ${
              query?.patreon === "required" ? "attention" : ""
            }`}
            aria-labelledby="patreon-access-title"
          >
            <div>
              <p className="eyebrow">Member download</p>
              <h2 id="patreon-access-title">
                Unlock this resource through Patreon
              </h2>
              <p>
                The complete details are public. Downloading checks your active
                Savage Library Patreon tier in real time.
              </p>
              {resource.allowedPatreonTiers?.length ? (
                <div className="patreon-tier-list">
                  {resource.allowedPatreonTiers.map((tier) => (
                    <span key={tier.id}>
                      {tier.title} · ${(tier.amountCents / 100).toFixed(2)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="patreon-access-actions">
              <Link
                className="button button-primary"
                href={`/api/auth/signin/patreon?callbackUrl=${encodeURIComponent(
                  `${ROUTES.resource(resource.slug)}?lang=${resource.activeLocale ?? "en"}`,
                )}`}
              >
                Sign in with Patreon
              </Link>
              <a
                className="button button-secondary"
                href={
                  resource.allowedPatreonTiers?.[0]?.url ??
                  process.env.PATREON_CAMPAIGN_URL ??
                  "https://www.patreon.com/"
                }
                target="_blank"
                rel="noreferrer"
              >
                View eligible tiers
              </a>
            </div>
          </section>
        ) : null}

        {["outdated", "unsupported"].includes(resource.compatibilityStatus) ? (
          <div className="notice notice-warning" role="alert">
            <strong>Compatibility warning.</strong>{" "}
            {resource.compatibilityNotes ??
              "This resource is not supported on the current Foundry VTT release."}
          </div>
        ) : null}

        <div className="details-layout">
          <div className="details-main">
            <section className="content-section">
              <h2>About</h2>
              <MarkdownContent markdown={resource.description} />
            </section>

            {resource.files.length ? (
              <section className="content-section">
                <h2>Files</h2>
                <div className="file-list">
                  {resource.files.map((file) => (
                    <div className="file-row" key={file.id}>
                      <div>
                        <strong>{file.name}</strong>
                        <span>
                          {file.kind.toUpperCase()} · {formatBytes(file.sizeBytes)}
                          {resource.accessMode === "patreon"
                            ? " · Patreon membership required"
                            : ""}
                        </span>
                      </div>
                      <Link
                        className="button button-secondary button-small"
                        href={ROUTES.download(file.id)}
                      >
                        Download
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {resource.protectedDownloads?.length ? (
              <section className="content-section">
                <h2>Member downloads</h2>
                <div className="file-list">
                  {resource.protectedDownloads.map((file) => (
                    <div className="file-row" key={file.id}>
                      <div>
                        <strong>{file.label}</strong>
                        <span>{file.role.toUpperCase()} · Patreon membership required</span>
                      </div>
                      <Link
                        className="button button-secondary button-small"
                        href={`/api/posts/links/${encodeURIComponent(file.id)}`}
                      >
                        Download
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {resource.installationInstructions ? (
              <details className="disclosure" open>
                <summary>Installation instructions</summary>
                <p>{resource.installationInstructions}</p>
              </details>
            ) : null}

            {resource.dependencies.length ? (
              <details className="disclosure">
                <summary>Dependencies ({resource.dependencies.length})</summary>
                <ul className="detail-list">
                  {resource.dependencies.map((dependency) => (
                    <li key={dependency.id}>
                      {dependency.url ? (
                        <Link href={dependency.url}>{dependency.name}</Link>
                      ) : (
                        dependency.name
                      )}
                      {dependency.versionRange
                        ? ` ${dependency.versionRange}`
                        : ""}
                      {!dependency.isRequired ? " (optional)" : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {resource.changelog.length ? (
              <details className="disclosure">
                <summary>Changelog ({resource.changelog.length})</summary>
                <div className="changelog">
                  {resource.changelog.map((entry) => (
                    <section key={entry.id}>
                      <div>
                        <strong>v{entry.version}</strong>
                        <time dateTime={entry.publishedAt}>
                          {formatDate(entry.publishedAt)}
                        </time>
                      </div>
                      <h3>{entry.summary}</h3>
                      {entry.details ? <p>{entry.details}</p> : null}
                    </section>
                  ))}
                </div>
              </details>
            ) : null}
          </div>

          <aside className="details-sidebar" aria-label="Resource information">
            <dl className="metadata-list">
              <div>
                <dt>Author</dt>
                <dd>
                  {resource.author.websiteUrl ? (
                    <a
                      href={resource.author.websiteUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {resource.author.name}
                    </a>
                  ) : (
                    resource.author.name
                  )}
                </dd>
              </div>
              <div>
                <dt>System</dt>
                <dd>{resource.gameSystem.name}</dd>
              </div>
              {resource.className ? (
                <div>
                  <dt>Class</dt>
                  <dd>{resource.className}</dd>
                </div>
              ) : null}
              {resource.subclassName ? (
                <div>
                  <dt>Subclass</dt>
                  <dd>{resource.subclassName}</dd>
                </div>
              ) : null}
              {resource.foundryMinimum || resource.foundryMaximum ? (
                <div>
                  <dt>Foundry support</dt>
                  <dd>
                    v{resource.foundryMinimum ?? "—"}–v
                    {resource.foundryMaximum ?? "current"}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Last updated</dt>
                <dd>{formatDate(resource.updatedAt)}</dd>
              </div>
              {resource.licenseName ? (
                <div>
                  <dt>License</dt>
                  <dd>
                    {resource.licenseUrl ? (
                      <a
                        href={resource.licenseUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {resource.licenseName}
                      </a>
                    ) : (
                      resource.licenseName
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>

            {resource.manifestUrl ? (
              <div className="manifest-block">
                <span>Manifest URL</span>
                <code>{resource.manifestUrl}</code>
                <CopyButton value={resource.manifestUrl} />
              </div>
            ) : null}

            <div className="tag-list">
              {resource.tags.map((tag) => (
                <Link
                  className="tag"
                  href={`${ROUTES.library}?tag=${tag.slug}`}
                  key={tag.id}
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </aside>
        </div>

        {resource.relatedResources.length ? (
          <section className="related-section" aria-labelledby="related-title">
            <div className="section-heading">
              <h2 id="related-title">Related resources</h2>
            </div>
            <ResourceGrid resources={resource.relatedResources} />
          </section>
        ) : null}
      </div>
    </article>
  );
}
