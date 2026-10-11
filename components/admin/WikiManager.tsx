"use client";
import { useCallback, useEffect, useState } from "react";
import type { AdminWikiGuide, WikiModule } from "../../lib/domain/wiki";
import { requestJson, type ApiFailure } from "../../lib/client/request";
import { WikiGuideEditor } from "./WikiGuideEditor";
export function WikiManager({ modules }: { modules: WikiModule[] }) {
  const [guides, setGuides] = useState<AdminWikiGuide[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selection, setSelection] = useState<AdminWikiGuide | null | undefined>(
    undefined,
  );
  const [status, setStatus] = useState("Loading guides…");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams({
        q: query,
        filter,
        page: String(page),
      });
      const result = await requestJson<
        ApiFailure & { guides?: AdminWikiGuide[]; pageCount?: number }
      >(`/api/admin/wiki?${params}`, { signal });
      if (signal?.aborted) return;
      if (result.ok && result.body.guides) {
        setGuides(result.body.guides);
        setPageCount(result.body.pageCount ?? 1);
        setStatus("");
      } else setStatus(result.body.error ?? "Guides could not be loaded.");
    },
    [query, filter, page],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void refresh(controller.signal), 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [refresh]);
  if (selection !== undefined)
    return (
      <WikiGuideEditor
        key={selection?.id ?? "new"}
        initial={selection}
        modules={modules}
        onClose={() => {
          setSelection(undefined);
          void refresh();
        }}
        onSaved={() => void refresh()}
      />
    );
  const visible = guides;
  return (
    <section aria-labelledby="wiki-admin-title">
      <header className="admin-section-heading">
        <p className="eyebrow">Module knowledge base</p>
        <h2 id="wiki-admin-title">Wiki guides</h2>
        <p>
          Administrator-written documentation. Draft changes stay private until
          published.
        </p>
      </header>
      <div className="wiki-search">
        <label>
          <span>Search guides</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All guides</option>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
          </select>
        </label>
        <button
          type="button"
          className="button button-primary"
          onClick={() => setSelection(null)}
        >
          + New guide
        </button>
      </div>
      <p role="status">{status}</p>
      {!status && !visible.length ? (
        <p className="wiki-panel">
          No guides found. Create a guide to get started.
        </p>
      ) : null}
      {visible.map((guide) => (
        <article key={guide.id} className="wiki-topic">
          <div>
            <h3>{guide.draft.translations[guide.draft.defaultLocale].title}</h3>
            <p>
              /{guide.slug} ·{" "}
              {modules.find((m) => m.id === guide.moduleId)?.title ??
                "General guides"}
            </p>
          </div>
          <div className="wiki-topic-meta">
            <span>{guide.isPublished ? "Published" : "Draft"}</span>
            {guide.starterResourceId &&
            !guide.isPublished &&
            !guide.draft.translations[guide.draft.defaultLocale].body.trim() ? (
              <span>Starter draft — add documentation</span>
            ) : null}
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setSelection(guide)}
            >
              Edit guide
            </button>
          </div>
        </article>
      ))}
      {pageCount > 1 ? (
        <nav className="pagination" aria-label="Guide pages">
          <button
            className="button button-secondary"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            className="button button-secondary"
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  );
}
