/** Escape PostgreSQL LIKE metacharacters so user searches remain literal. */
export function containsPattern(value: string): string {
  return `%${value
    .trim()
    .slice(0, 120)
    .replace(/[\\%_]/g, "\\$&")}%`;
}

export function pagination(total: number, requested: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(
    1,
    Math.min(pageCount, Number.isFinite(requested) ? Math.floor(requested) : 1),
  );
  return { total, page, pageCount, pageSize, offset: (page - 1) * pageSize };
}
