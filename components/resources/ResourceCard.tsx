import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "../../lib/config/site";
import type { ResourceSummary } from "../../lib/domain/resource";
import { formatCompactNumber, formatDate } from "../../lib/format";
import { CompatibilityBadge } from "./CompatibilityBadge";

const typeLabels: Record<ResourceSummary["resourceType"], string> = {
  module: "Module",
  class: "Class",
  subclass: "Subclass",
  pdf: "PDF",
  macro: "Macro",
};

export function ResourceCard({ resource }: { resource: ResourceSummary }) {
  return (
    <article className="resource-card">
      <span className="resource-card-accent" aria-hidden="true" />
      <div className="resource-card-top">
        <div className="resource-thumb" aria-hidden="true">
          <Image
            src={resource.cardArtworkUrl ?? "/savage-library-logo.svg"}
            alt=""
            width={52}
            height={52}
          />
        </div>
        <div className="resource-card-heading">
          <div className="resource-kicker">
            <span>{typeLabels[resource.resourceType]}</span>
            <span aria-hidden="true">·</span>
            <span>{resource.gameSystem.name}</span>
          </div>
          <h3>
            <Link href={ROUTES.resource(resource.slug)}>{resource.title}</Link>
          </h3>
        </div>
        <CompatibilityBadge status={resource.compatibilityStatus} />
      </div>

      {resource.accessMode === "patreon" ? (
        <span className="resource-access-label">Patreon member download</span>
      ) : null}

      <p className="resource-description">{resource.shortDescription}</p>

      <dl className="resource-facts">
        <div>
          <dt>Version</dt>
          <dd>{resource.currentVersion}</dd>
        </div>
        <div>
          <dt>Foundry</dt>
          <dd>
            {resource.foundryVerified
              ? `v${resource.foundryVerified}`
              : "Not applicable"}
          </dd>
        </div>
        <div>
          <dt>Author</dt>
          <dd>{resource.author.name}</dd>
        </div>
      </dl>

      <div className="tag-list" aria-label="Tags">
        {resource.tags.slice(0, 3).map((tag) => (
          <Link
            className="tag"
            href={`${ROUTES.library}?tag=${encodeURIComponent(tag.slug)}`}
            key={tag.id}
          >
            {tag.name}
          </Link>
        ))}
      </div>

      <div className="resource-card-footer">
        <span title={`Updated ${formatDate(resource.updatedAt)}`}>
          {formatCompactNumber(resource.downloadCount)} downloads
        </span>
        <Link
          className="button button-secondary button-small"
          href={ROUTES.resource(resource.slug)}
        >
          Open entry
        </Link>
      </div>
    </article>
  );
}
