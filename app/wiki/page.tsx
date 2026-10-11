import type { Metadata } from "next";
import {
  browsePublicWiki,
  publicWikiModules,
} from "../../lib/repositories/wiki-repository";
import { Pagination } from "../../components/library/Pagination";
import { WikiCard } from "../../components/wiki/WikiCard";
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
  const [catalog, modules] = await Promise.all([
    browsePublicWiki(q, moduleId, Number(single("page") || 1)),
    publicWikiModules(),
  ]);
  return (
    <section className="page-section">
      <div className="container">
        <header className="page-heading">
          <p className="eyebrow">The keeper’s knowledge base</p>
          <h1>Wiki</h1>
          <p>Guides, instructions, and answers for your modules.</p>
        </header>
        {catalog.items.some((g) => g.sample) ? (
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
          <div className="resource-grid wiki-card-grid">
            {catalog.items.map((guide) => (
              <WikiCard key={guide.id} guide={guide} lang={lang} />
            ))}
          </div>
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
