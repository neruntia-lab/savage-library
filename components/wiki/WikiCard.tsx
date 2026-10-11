import Image from "next/image";
import Link from "next/link";
import type { PublicWikiGuide, WikiLocale } from "../../lib/domain/wiki";
import { wikiLanguage } from "../../lib/services/wiki";

export function WikiCard({
  guide,
  lang,
}: {
  guide: PublicWikiGuide;
  lang: WikiLocale;
}) {
  const language = wikiLanguage(guide.content, lang);
  const href = `/wiki/${encodeURIComponent(guide.slug)}?lang=${lang}`;
  return (
    <article className="resource-card wiki-card">
      <span className="resource-card-accent" aria-hidden="true" />
      <div className="resource-card-top">
        <div className="resource-thumb" aria-hidden="true">
          <Image
            src={guide.module?.cardArtworkUrl ?? "/savage-library-logo.svg"}
            alt=""
            width={52}
            height={52}
          />
        </div>
        <div className="resource-card-heading">
          <div className="resource-kicker">
            {guide.module?.title ?? "General guide"}
          </div>
          <h3>
            <Link href={href}>{language.translation.title}</Link>
          </h3>
        </div>
      </div>
      <p className="resource-description">{language.translation.summary}</p>
      <div className="tag-list" aria-label="Available languages">
        {language.available.map((locale) => (
          <span className="tag" key={locale}>
            {locale === "en" ? "English" : "Español"}
          </span>
        ))}
      </div>
      <div className="resource-card-footer">
        <span>
          Updated{" "}
          <time dateTime={guide.publishedAt}>
            {new Date(guide.publishedAt).toLocaleDateString("en-US", {
              dateStyle: "medium",
              timeZone: "UTC",
            })}
          </time>
        </span>
        <Link className="button button-secondary button-small" href={href}>
          Open guide
        </Link>
      </div>
    </article>
  );
}
