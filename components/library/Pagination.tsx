import Link from "next/link";

export function Pagination({
  page,
  pageCount,
  searchParams,
  basePath = "/library",
}: {
  page: number;
  pageCount: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath?: string;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav className="pagination" aria-label="Resource pages">
      {page > 1 ? (
        <Link
          className="button button-secondary button-small"
          href={pageHref(basePath, searchParams, page - 1)}
          rel="prev"
        >
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span>
        Page <strong>{page}</strong> of {pageCount}
      </span>
      {page < pageCount ? (
        <Link
          className="button button-secondary button-small"
          href={pageHref(basePath, searchParams, page + 1)}
          rel="next"
        >
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function pageHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value) {
      params.set(key, value);
    }
  }
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}
