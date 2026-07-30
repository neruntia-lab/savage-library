import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import {
  authenticatePublisherToken,
  createReleaseDraftFromUploadedBlob,
} from "../../../../lib/repositories/publisher-repository";
import { privateBlobToken } from "../../../../lib/config/blob";
import { requireApiAdmin } from "../../../../lib/services/auth";

type Payload = {
  resourceId: string;
  originalName: string;
  sizeBytes: number;
  source: "admin" | "cli";
  uploadedBy: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return Response.json({ error: "Invalid upload request." }, { status: 400 });
  const parsed = parsePayload(
    body.type === "blob.generate-client-token"
      ? body.payload.clientPayload
      : body.payload.tokenPayload,
  );
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  let payload = parsed.value;

  if (body.type === "blob.generate-client-token") {
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (bearer && (await authenticatePublisherToken(payload.resourceId, bearer))) {
      payload = { ...payload, source: "cli", uploadedBy: "publisher-cli" };
    } else {
      const auth = await requireApiAdmin();
      if (!auth.ok) return auth.response;
      payload = { ...payload, source: "admin", uploadedBy: auth.user.id };
    }
  }

  const token = privateBlobToken();
  if (!token) {
    return Response.json({ error: "Private module storage is unavailable." }, { status: 503 });
  }

  try {
    const response = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`foundry-release-uploads/${payload.resourceId}/`)) {
          throw new Error("The release upload path is invalid.");
        }
        return {
          allowedContentTypes: ["application/zip", "application/x-zip-compressed"],
          maximumSizeInBytes: 250 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const completed = parsePayload(tokenPayload);
        if (!completed.ok) throw new Error(completed.error);
        await createReleaseDraftFromUploadedBlob({
          ...completed.value,
          blob,
        });
      },
    });
    return Response.json(response);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Release upload failed." },
      { status: 400 },
    );
  }
}

function parsePayload(source: string | null | undefined):
  | { ok: true; value: Payload }
  | { ok: false; error: string } {
  try {
    const value = JSON.parse(source ?? "") as Record<string, unknown>;
    if (
      typeof value.resourceId !== "string" ||
      typeof value.originalName !== "string" ||
      typeof value.sizeBytes !== "number" ||
      value.sizeBytes <= 0 ||
      value.sizeBytes > 250 * 1024 * 1024
    ) {
      return { ok: false, error: "Release upload metadata is invalid." };
    }
    return {
      ok: true,
      value: {
        resourceId: value.resourceId.slice(0, 160),
        originalName: value.originalName.slice(0, 255),
        sizeBytes: value.sizeBytes,
        source: value.source === "cli" ? "cli" : "admin",
        uploadedBy:
          typeof value.uploadedBy === "string"
            ? value.uploadedBy.slice(0, 160)
            : "publisher",
      },
    };
  } catch {
    return { ok: false, error: "Release upload metadata is invalid." };
  }
}
