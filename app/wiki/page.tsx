import type { Metadata } from "next";
import Link from "next/link";
import { listPublicWiki } from "../../lib/repositories/wiki-repository";
import { browseWiki, wikiLanguage } from "../../lib/services/wiki";
import { Pagination } from "../../components/library/Pagination";
import type { PublicWikiGuide } from "../../lib/domain/wiki";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Wiki",
  description: "Module documentation and guides from Savage Library.",
};
export default async function WikiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const single = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const q = single("q").trim().slice(0, 120),
    moduleId = single("module"),
    lang = single("lang") === "es" ? "es" : "en";
  const guides = await listPublicWiki();
  const catalog = browseWiki(guides, q, moduleId, Number(single("page") || 1));
  const modules = Array.from(
    new Map(
      guides.filter((g) => g.module).map((g) => [g.module!.id, g.module!]),
    ).values(),
  ).sort((a, b) => a.title.localeCompare(b.title));
  const groups = new Map<
    string,
    { title: string; guides: PublicWikiGuide[] }
  >();
  for (const guide of catalog.items) {
    const key = guide.module?.id ?? "general";
    if (!groups.has(key))
      groups.set(key, {
        title: guide.module?.title ?? "General guides",
        guides: [],
      });
    groups.get(key)!.guides.push(guide);
  }
  return (
    <section className="page-section">
      <div className="container">
        <header className="page-heading">
          <p className="eyebrow">The keeper’s knowledge base</p>
          <h1>Wiki</h1>
          <p>Guides, instructions, and answers for your modules.</p>
        </header>
        {guides.some((g) => g.sample) ? (
          <p className="notice">
            Local preview samples — not production documentation.
          </p>
        ) : null}
        <form action="/wiki" method="get" className="wiki-search">
          <label>
            <span>Search guides</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={120}
              placeholder="Installation, settings, or a module…"
            />
          </label>
          <label>
            <span>Module</span>
            <select name="module" defaultValue={moduleId}>
              <option value="">All modules</option>
              <option value="general">General guides</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="lang" value={lang} />
          <button className="button button-primary" type="submit">
            Search
          </button>
        </form>
        <p className="catalog-summary">
          {catalog.total} {catalog.total === 1 ? "guide" : "guides"}
        </p>
        {!catalog.total ? (
          <div className="wiki-panel">
            <h2>No guides found</h2>
            <p>
              {q || moduleId
                ? "Try another search or module."
                : "Module documentation will appear here when published."}
            </p>
          </div>
        ) : (
          Array.from(groups.entries()).map(([id, group]) => (
            <section
              key={id}
              className="wiki-topic-group"
              aria-labelledby={`group-${id}`}
            >
              <h2 id={`group-${id}`}>{group.title}</h2>
              {group.guides.map((guide) => {
                const translation = wikiLanguage(
                  guide.content,
                  lang,
                ).translation;
                return (
                  <article className="wiki-topic" key={guide.id}>
                    <div>
                      <Link
                        className="wiki-topic-title"
                        href={`/wiki/${encodeURIComponent(guide.slug)}?lang=${lang}`}
                      >
                        {translation.title}
                      </Link>
                      <p>{translation.summary}</p>
                    </div>
                    <div className="wiki-topic-meta">
                      <span>
                        {wikiLanguage(guide.content)
                          .available.map((l) =>
                            l === "en" ? "English" : "Español",
                          )
                          .join(" · ")}
                      </span>
                      <time dateTime={guide.publishedAt}>
                        {new Date(guide.publishedAt).toLocaleDateString(
                          "en-US",
                          { dateStyle: "medium", timeZone: "UTC" },
                        )}
                      </time>
                    </div>
                  </article>
                );
              })}
            </section>
          ))
        )}
        <Pagination
          page={catalog.page}
          pageCount={catalog.pageCount}
          basePath="/wiki"
          searchParams={{ q, module: moduleId, lang }}
        />
      </div>
    </section>
  );
}
