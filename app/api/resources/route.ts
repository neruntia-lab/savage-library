import {
  createResource,
  listAdminResources,
  listCatalog,
} from "../../../lib/repositories/resource-repository";
import { requireApiAdmin } from "../../../lib/services/auth";
import { parseCatalogFilters } from "../../../lib/services/catalog";
import {
  enforceRateLimit,
  requestIdentifier,
} from "../../../lib/services/rate-limit";
import { validateResourceInput } from "../../../lib/validation/resource";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("admin") === "1") {
    const auth = await requireApiAdmin();
    if (!auth.ok) return auth.response;
    return Response.json({ resources: await listAdminResources() });
  }

  const limit = await enforceRateLimit({
    scope: "search",
    identifier: requestIdentifier(request),
    limit: 90,
    windowSeconds: 60,
  });
  if (!limit.allowed) return limit.response;

  const params = Object.fromEntries(url.searchParams.entries());
  const filters = parseCatalogFilters(params);
  const catalog = await listCatalog(filters);
  return Response.json(catalog, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "X-RateLimit-Remaining": String(limit.remaining),
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => null);
  const validation = validateResourceInput(payload);
  if (!validation.success) {
    return Response.json({ errors: validation.errors }, { status: 400 });
  }

  try {
    const id = await createResource(validation.data);
    return Response.json({ id }, { status: 201 });
  } catch {
    return Response.json(
      { error: "The resource could not be created." },
      { status: 500 },
    );
  }
}
