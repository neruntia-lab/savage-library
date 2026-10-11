import Link from "next/link";
import type { PublicWikiGuide, WikiLocale } from "../../lib/domain/wiki";
import { wikiLanguage } from "../../lib/services/wiki";
import { ROUTES } from "../../lib/config/site";

export type WikiDocument = {
  html: string;
  headings: { id: string; title: string }[];
};
export function GuidePresentation({
  guide,
  requestedLocale,
  document,
  preview = false,
}: {
  guide: PublicWikiGuide;
  requestedLocale?: WikiLocale;
  document: WikiDocument;
  preview?: boolean;
}) {
  const language = wikiLanguage(guide.content, requestedLocale);
  return (
    <article className="wiki-guide">
      {!preview ? (
        <nav className="wiki-breadcrumb" aria-label="Breadcrumb">
          <Link href={ROUTES.home}>Library</Link>
          <span aria-hidden="true"> / </span>
          <Link href={ROUTES.wiki}>Wiki</Link>
          <span aria-hidden="true"> / </span>
          <span>{language.translation.title}</span>
        </nav>
      ) : null}
      {guide.sample ? (
        <p className="notice">
          Local preview sample — not production documentation.
        </p>
      ) : null}
      <header className="page-heading">
        <p className="eyebrow">{guide.module?.title ?? "General guides"}</p>
        <h1>{language.translation.title || "Untitled guide"}</h1>
        <p>{language.translation.summary}</p>
        <p className="wiki-date">
          {preview ? (
            "Unpublished preview"
          ) : (
            <>
              Updated{" "}
              <time dateTime={guide.publishedAt}>
                {new Date(guide.publishedAt).toLocaleDateString("en-US", {
                  dateStyle: "long",
                  timeZone: "UTC",
                })}
              </time>
            </>
          )}
        </p>
        {guide.module ? (
          <Link href={ROUTES.resource(guide.module.slug)}>View module →</Link>
        ) : null}
      </header>
      {!preview && language.available.length > 1 ? (
        <nav className="wiki-language-tabs" aria-label="Guide language">
          {language.available.map((locale) => (
            <Link
              key={locale}
              aria-current={language.locale === locale ? "page" : undefined}
              href={`/wiki/${encodeURIComponent(guide.slug)}?lang=${locale}`}
            >
              {locale === "en" ? "English" : "Español"}
            </Link>
          ))}
        </nav>
      ) : null}
      {language.fallback ? (
        <p role="status" className="notice">
          This translation is not available. Showing{" "}
          {language.locale === "en" ? "English" : "Spanish"}.
        </p>
      ) : null}
      <div className="wiki-guide-layout">
        {document.headings.length ? (
          <nav className="wiki-toc" aria-label="On this page">
            <p className="eyebrow">On this page</p>
            {document.headings.map((heading) => (
              <a key={heading.id} href={`#${heading.id}`}>
                {heading.title}
              </a>
            ))}
          </nav>
        ) : null}
        <div
          className="markdown-content wiki-body"
          dangerouslySetInnerHTML={{ __html: document.html }}
        />
      </div>
    </article>
  );
}
