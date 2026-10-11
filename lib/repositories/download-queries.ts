import { sql } from "drizzle-orm";

export type DownloadEvent = {
  resourceId: string;
  fileId: string;
  visitorHash?: string;
};

// A single SQL statement keeps audit insertion and both counters atomic.
export function downloadEventQuery(
  input: DownloadEvent,
  id = crypto.randomUUID(),
) {
  return sql`WITH recorded AS (
    INSERT INTO downloads (id, resource_id, file_id, visitor_hash)
    SELECT ${id}, id, ${input.fileId}, ${input.visitorHash ?? null}
    FROM resources WHERE id = ${input.resourceId}
    RETURNING resource_id
  ) UPDATE resources SET download_count = download_count + 1,
    popularity_score = popularity_score + 1
    WHERE id IN (SELECT resource_id FROM recorded) RETURNING id`;
}
