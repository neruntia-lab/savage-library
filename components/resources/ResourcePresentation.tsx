import Link from "next/link";
import Image from "next/image";
import { MarkdownContent } from "./MarkdownContent";
import { CompatibilityBadge } from "./CompatibilityBadge";
import { ResourceGrid } from "./ResourceGrid";
import { CopyButton } from "../ui/CopyButton";
import { ROUTES } from "../../lib/config/site";
import { formatBytes, formatDate, formatLongDate } from "../../lib/format";
import type { ResourceDetails } from "../../lib/domain/resource";
import type { AuthorizedUser } from "../../lib/services/auth";
import { parseReleaseNotes } from "../../lib/validation/release-notes";

export function ResourcePresentation({
  resource,
  isPreview,
  previewId,
  user,
  entitled,
  canAccessDownloads,
  isModule,
  isPublic,
  publicManifestUrl,
  patreonRequired,
}: {
  resource: ResourceDetails;
  isPreview: boolean;
  previewId?: string;
  user: AuthorizedUser | null;
  entitled: boolean;
  canAccessDownloads: boolean;
  isModule: boolean;
  isPublic: boolean;
  publicManifestUrl: string | null;
  patreonRequired: boolean;
}) {
  const artworkUrl = resource.heroArtworkUrl ?? "/logo.png";
  const hasCustomCover = Boolean(
    !artworkUrl.endsWith("/logo.png") &&
    !artworkUrl.endsWith("/savage-library-logo.svg"),
  );

  return (
    <article className="section page-section">
      <div className="container">
        {isPreview ? (
          <div className="admin-preview-banner" role="status">
            <span>Private draft preview</span>
            <div>
              <span>Downloads and manifests are disabled</span>
              <Link href={`/admin/resources/${previewId}`}>
                Return to editor
              </Link>
            </div>
          </div>
        ) : null}
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
              src={artworkUrl}
              className={hasCustomCover ? "custom-artwork" : "fallback-artwork"}
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
              <span>
                {resource.pricing === "free"
                  ? "Free"
                  : (resource.priceLabel ?? "Premium")}
              </span>
            </div>
            <div className="resource-actions">
              {isPreview &&
              (publicManifestUrl || (!isModule && resource.files[0])) ? (
                <button
                  className="button button-primary"
                  type="button"
                  disabled
                >
                  {isModule
                    ? "Copy manifest link"
                    : `Download ${resource.files[0]?.kind.toUpperCase()}`}
                </button>
              ) : publicManifestUrl ? (
                <CopyButton value={publicManifestUrl} />
              ) : !isModule && canAccessDownloads && resource.files[0] ? (
                <Link
                  className="button button-primary"
                  href={ROUTES.download(resource.files[0].id)}
                >
                  Download {resource.files[0].kind.toUpperCase()}
                </Link>
              ) : isPublic && resource.projectUrl ? (
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
          <nav
            className="resource-language-switcher"
            aria-label="Resource language"
          >
            <span>Language</span>
            <Link
              className={resource.activeLocale === "en" ? "active" : ""}
              href={`${ROUTES.resource(resource.slug)}?lang=en${previewId ? `&preview=${encodeURIComponent(previewId)}` : ""}`}
            >
              English
            </Link>
            <Link
              className={resource.activeLocale === "es" ? "active" : ""}
              href={`${ROUTES.resource(resource.slug)}?lang=es${previewId ? `&preview=${encodeURIComponent(previewId)}` : ""}`}
            >
              Español
            </Link>
          </nav>
        ) : null}

        {resource.accessMode === "patreon" ? (
          <section
            className={`patreon-access-panel ${
              patreonRequired ? "attention" : ""
            }`}
            aria-labelledby="patreon-access-title"
          >
            <div>
              <p className="eyebrow">Member download</p>
              <h2 id="patreon-access-title">
                Unlock this resource through Patreon
              </h2>
              <p>
                {entitled
                  ? "Your membership is verified. Eligible downloads are available below."
                  : user
                    ? "Your account does not currently have an eligible membership tier."
                    : "The complete details are public. Sign in to verify your active Savage Library Patreon tier."}
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
              {!user && !isPreview ? (
                <Link
                  className="button button-primary"
                  href={`/api/auth/signin/patreon?callbackUrl=${encodeURIComponent(
                    `${ROUTES.resource(resource.slug)}?lang=${resource.activeLocale ?? "en"}`,
                  )}`}
                >
                  Sign in with Patreon
                </Link>
              ) : null}
              {isPreview ? (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled
                >
                  View eligible tiers
                </button>
              ) : (
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
              )}
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

            {!isModule && canAccessDownloads && resource.files.length ? (
              <section className="content-section">
                <h2>Files</h2>
                <div className="file-list">
                  {resource.files.map((file) => (
                    <div className="file-row" key={file.id}>
                      <div>
                        <strong>{file.name}</strong>
                        <span>
                          {file.kind.toUpperCase()} ·{" "}
                          {formatBytes(file.sizeBytes)}
                          {resource.accessMode === "patreon"
                            ? " · Patreon membership required"
                            : ""}
                        </span>
                      </div>
                      {isPreview ? (
                        <button
                          className="button button-secondary button-small"
                          type="button"
                          disabled
                        >
                          Download
                        </button>
                      ) : (
                        <Link
                          className="button button-secondary button-small"
                          href={ROUTES.download(file.id)}
                        >
                          Download
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {canAccessDownloads && resource.protectedDownloads?.length ? (
              <section className="content-section">
                <h2>Member downloads</h2>
                <div className="file-list">
                  {resource.protectedDownloads.map((file) => (
                    <div className="file-row" key={file.id}>
                      <div>
                        <strong>{file.label}</strong>
                        <span>
                          {file.role.toUpperCase()} · Patreon membership
                          required
                        </span>
                      </div>
                      {isPreview ? (
                        <button
                          className="button button-secondary button-small"
                          type="button"
                          disabled
                        >
                          Download
                        </button>
                      ) : (
                        <Link
                          className="button button-secondary button-small"
                          href={`/api/posts/links/${encodeURIComponent(file.id)}`}
                        >
                          Download
                        </Link>
                      )}
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
                  {resource.changelog.map((entry) => {
                    const changes = parseReleaseNotes(
                      entry.summary,
                      entry.details,
                    );
                    return (
                      <section key={entry.id}>
                        {changes ? (
                          <>
                            <div className="patch-note-heading">
                              <time dateTime={entry.publishedAt}>
                                {formatLongDate(entry.publishedAt)}
                              </time>
                              <span aria-hidden="true">-</span>
                              <strong>v{entry.version}</strong>
                            </div>
                            <ul className="patch-note-list">
                              {changes.map((change) => (
                                <li key={change}>{change}</li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <>
                            <div>
                              <strong>v{entry.version}</strong>
                              <time dateTime={entry.publishedAt}>
                                {formatDate(entry.publishedAt)}
                              </time>
                            </div>
                            <h3>{entry.summary}</h3>
                            {entry.details ? <p>{entry.details}</p> : null}
                          </>
                        )}
                      </section>
                    );
                  })}
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

            <div className="tag-list">
              {resource.tags.map((tag) => (
                <span className="tag" key={tag.id}>
                  {tag.name}
                </span>
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
