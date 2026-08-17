import { synchronizePublisherCatalog, PublisherCatalogError } from "../../../../lib/repositories/publisher-catalog-repository";
import { requireAdminCliToken } from "../../../../lib/services/admin-cli-auth";

export async function POST(request: Request) {
  const auth = await requireAdminCliToken(request);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !isRecord(body.module) || !isRecord(body.resource)) return Response.json({ ok: false, code: "invalid_request", error: "Module and resource metadata are required." }, { status: 400 });
  const manifestData = body.module;
  if (![manifestData.id, manifestData.title, manifestData.description, manifestData.version].every((value) => typeof value === "string" && value.trim())) return Response.json({ ok: false, code: "invalid_request", error: "Module id, title, description, and version are required." }, { status: 400 });
  try {
    const result = await synchronizePublisherCatalog({
      module: manifestData as never,
      resource: body.resource as never,
      expectedRevision: typeof body.expectedRevision === "number" ? body.expectedRevision : undefined,
      needsPublisherToken: body.needsPublisherToken === true,
      canCreate: auth.credential.scopes.includes("resource:create"),
      canUpdate: auth.credential.scopes.includes("resource:update"),
    });
    return Response.json({ ok: true, resource: result });
  } catch (error) {
    if (error instanceof PublisherCatalogError) return Response.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    return Response.json({ ok: false, code: "catalog_sync_failed", error: "Catalog synchronization failed." }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
