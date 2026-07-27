import { del } from "@vercel/blob";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { revalidatePath } from "next/cache";
import {
  getSiteAppearanceFromDatabase,
  restoreDefaultHero,
  setHeroImage,
} from "../../../../lib/repositories/site-settings-repository";
import { requireApiAdmin } from "../../../../lib/services/auth";
import {
  HERO_IMAGE_MAX_BYTES,
  HERO_IMAGE_TYPES,
  validateHeroFileMetadata,
} from "../../../../lib/validation/hero-image";

type HeroUploadPayload = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  updatedBy: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return Response.json({ error: "Invalid upload request." }, { status: 400 });
  }

  let authenticatedAdminId: string | null = null;
  if (body.type === "blob.generate-client-token") {
    const auth = await requireApiAdmin();
    if (!auth.ok) return auth.response;
    authenticatedAdminId = auth.user.id;
  }

  const source =
    body.type === "blob.generate-client-token"
      ? body.payload.clientPayload
      : body.payload.tokenPayload;
  const parsed = parsePayload(source);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const payload = {
    ...parsed.value,
    updatedBy: authenticatedAdminId ?? parsed.value.updatedBy,
  };
  const token = process.env.PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return Response.json(
      { error: "Public image storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const response = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("site-media/hero/")) {
          throw new Error("The upload path is invalid.");
        }
        return {
          allowedContentTypes: [...HERO_IMAGE_TYPES],
          maximumSizeInBytes: HERO_IMAGE_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const completed = parsePayload(tokenPayload);
        if (!completed.ok) throw new Error(completed.error);
        const previous = await getSiteAppearanceFromDatabase();
        await setHeroImage({
          url: blob.url,
          pathname: blob.pathname,
          originalName: completed.value.originalName,
          mimeType: completed.value.mimeType,
          sizeBytes: completed.value.sizeBytes,
          updatedBy: completed.value.updatedBy,
        });
        revalidatePath("/");
        if (
          previous.heroImagePathname &&
          previous.heroImagePathname !== blob.pathname
        ) {
          await del(previous.heroImagePathname, { token }).catch(() => undefined);
        }
      },
    });
    return Response.json(response);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "The upload could not complete.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const token = process.env.PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return Response.json(
      { error: "Public image storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const previousPathname = await restoreDefaultHero();
    revalidatePath("/");
    if (previousPathname) {
      await del(previousPathname, { token }).catch(() => undefined);
    }
    return Response.json({ restored: true });
  } catch {
    return Response.json(
      { error: "The bundled banner could not be restored." },
      { status: 500 },
    );
  }
}

function parsePayload(
  source: string | null | undefined,
): { ok: true; value: HeroUploadPayload } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(source ?? "");
  } catch {
    return { ok: false, error: "Upload metadata is invalid." };
  }
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Upload metadata is invalid." };
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.originalName !== "string" ||
    typeof input.mimeType !== "string" ||
    typeof input.sizeBytes !== "number" ||
    typeof input.updatedBy !== "string"
  ) {
    return { ok: false, error: "Upload metadata is incomplete." };
  }
  const validation = validateHeroFileMetadata({
    name: input.originalName,
    type: input.mimeType,
    size: input.sizeBytes,
  });
  if (!validation.valid) return { ok: false, error: validation.message };
  return {
    ok: true,
    value: {
      originalName: input.originalName.slice(0, 255),
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      updatedBy: input.updatedBy.slice(0, 160),
    },
  };
}
