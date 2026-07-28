import { NextRequest, NextResponse } from "next/server";
import {
  createSignedDownloadUrl,
  getDownloadRecord,
  recordDownload,
} from "../../../../lib/repositories/file-repository";
import { getAuthorizedUser } from "../../../../lib/services/auth";
import { resolveEntitlement } from "../../../../lib/services/entitlements";
import {
  enforceRateLimit,
  requestIdentifier,
} from "../../../../lib/services/rate-limit";

type RouteContext = { params: Promise<{ fileId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const identifier = requestIdentifier(request);
  const limit = await enforceRateLimit({
    scope: "download",
    identifier,
    limit: 30,
    windowSeconds: 60,
  });
  if (!limit.allowed) return limit.response;

  const { fileId } = await context.params;
  try {
    const record = await getDownloadRecord(fileId);
    if (!record) {
      return Response.json({ error: "File not found." }, { status: 404 });
    }

    const user = await getAuthorizedUser();
    if (record.resource.accessMode === "patreon" && !user?.isAdmin) {
      if (!user) {
        const signIn = new URL("/api/auth/signin/patreon", request.url);
        signIn.searchParams.set("callbackUrl", request.url);
        return NextResponse.redirect(signIn);
      }

      const entitlement = await resolveEntitlement({
        user,
        request,
        requiredTierIds: record.allowedTierIds,
      });
      if (!entitlement.entitled) {
        const resourceUrl = new URL(
          `/resources/${record.resource.slug}`,
          request.url,
        );
        resourceUrl.searchParams.set("patreon", "required");
        return NextResponse.redirect(resourceUrl);
      }
    }

    await recordDownload({
      resourceId: record.resource.id,
      fileId: record.file.id,
      user,
      visitorHash: user ? await hashValue(user.id) : await hashVisitor(identifier, request),
    });

    const signedUrl = await createSignedDownloadUrl(record.file.storageKey);
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The download could not be completed.",
      },
      { status: 502 },
    );
  }
}

async function hashVisitor(
  identifier: string,
  request: Request,
): Promise<string> {
  return hashValue(
    `${identifier}|${request.headers.get("user-agent") ?? ""}`,
  );
}

async function hashValue(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
