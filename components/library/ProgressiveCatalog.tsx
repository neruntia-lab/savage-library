"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogFilters, CatalogResult } from "../../lib/domain/resource";
import { publicCatalogParams } from "../../lib/services/catalog";
import { requestJson, type ApiFailure } from "../../lib/client/request";
import { ResourceGrid } from "../resources/ResourceGrid";

export function ProgressiveCatalog({
  initial,
  filters,
}: {
  initial: CatalogResult;
  filters: CatalogFilters;
}) {
  const [catalog, setCatalog] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const params = new URLSearchParams(
    publicCatalogParams({ ...filters, page: catalog.page + 1 }),
  );
  async function loadMore(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    const result = await requestJson<ApiFailure & CatalogResult>(
      `/api/resources?${params}`,
      { signal: controller.signal },
    );
    if (!controller.signal.aborted) {
      if (
        result.ok &&
        Array.isArray(result.body.items) &&
        result.body.page === catalog.page + 1
      ) {
        setCatalog((current) => ({
          ...result.body,
          items: Array.from(
            new Map(
              [...current.items, ...result.body.items].map((item) => [
                item.id,
                item,
              ]),
            ).values(),
          ),
        }));
      } else
        setError(
          result.body.error ??
            "More resources could not be loaded. Please retry.",
        );
      setBusy(false);
    }
    request.current = null;
  }
  return (
    <>
      <ResourceGrid resources={catalog.items} />
      <div className="catalog-summary" role="status" aria-live="polite">
        {busy
          ? "Loading more resources…"
          : error ||
            `${catalog.items.length} of ${catalog.total} resources shown`}
      </div>
      {catalog.page < catalog.pageCount ? (
        <a
          className="button button-secondary"
          href={`/?${params}#library`}
          onClick={loadMore}
          aria-disabled={busy}
        >
          {busy ? "Loading…" : error ? "Retry loading more" : "Load more"}
        </a>
      ) : null}
    </>
  );
}
