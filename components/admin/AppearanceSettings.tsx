"use client";

import { upload } from "@vercel/blob/client";
import { useCallback, useRef, useState } from "react";
import {
  DEFAULT_HERO_IMAGE,
  type SiteAppearance,
} from "../../lib/domain/site-appearance";
import {
  validateHeroDimensions,
  validateHeroFileMetadata,
} from "../../lib/validation/hero-image";

export function AppearanceSettings({
  initialAppearance,
  onStatus,
}: {
  initialAppearance: SiteAppearance;
  onStatus: (message: string) => void;
}) {
  const [appearance, setAppearance] =
    useState<SiteAppearance>(initialAppearance);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadAppearance = useCallback(async () => {
    const response = await fetch("/api/admin/site-settings");
    const body = (await response.json().catch(() => ({}))) as
      | SiteAppearance
      | { error?: string };
    if (!response.ok || !("heroImageUrl" in body)) {
      onStatus(
        "error" in body && body.error
          ? body.error
          : "Appearance settings could not be loaded.",
      );
      return;
    }
    setAppearance(body);
  }, [onStatus]);

  async function replaceBanner(file: File) {
    const metadata = validateHeroFileMetadata(file);
    if (!metadata.valid) {
      onStatus(metadata.message);
      return;
    }
    const dimensions = await readDimensions(file).catch(() => null);
    if (!dimensions) {
      onStatus("The image dimensions could not be read.");
      return;
    }
    const dimensionCheck = validateHeroDimensions(
      dimensions.width,
      dimensions.height,
    );
    if (!dimensionCheck.valid) {
      onStatus(dimensionCheck.message);
      return;
    }
    if (
      !window.confirm(
        "Replace the homepage banner? The new image will become visible immediately.",
      )
    ) {
      return;
    }

    setBusy(true);
    setProgress(0);
    onStatus("Uploading the new banner…");
    try {
      await upload(`site-media/hero/${safeFilename(file.name)}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/hero-upload",
        clientPayload: JSON.stringify({
          originalName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          updatedBy: "shared-admin",
        }),
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });
      await loadAppearance();
      onStatus("Homepage banner replaced.");
    } catch (error) {
      onStatus(
        error instanceof Error ? error.message : "The banner upload failed.",
      );
    } finally {
      setBusy(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function restoreDefault() {
    if (
      !window.confirm(
        "Restore the bundled arcane archive banner? The current upload will be removed.",
      )
    ) {
      return;
    }
    setBusy(true);
    onStatus("Restoring the bundled banner…");
    const response = await fetch("/api/admin/hero-upload", { method: "DELETE" });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.ok) {
      await loadAppearance();
      onStatus("Bundled banner restored.");
    } else {
      onStatus(body.error ?? "The bundled banner could not be restored.");
    }
    setBusy(false);
  }

  const imageUrl = appearance.heroImageUrl ?? DEFAULT_HERO_IMAGE;

  return (
    <section className="admin-panel appearance-settings">
      <div className="appearance-heading">
        <div>
          <p className="eyebrow">Homepage artwork</p>
          <h2>Hero banner</h2>
          <p>
            Preview the fixed desktop and mobile crops before replacing the
            image seen by visitors.
          </p>
        </div>
        <div className="appearance-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void replaceBanner(file);
            }}
          />
          <button
            type="button"
            className="button button-primary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Working…" : "Replace banner image"}
          </button>
          {!appearance.isDefault ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={restoreDefault}
              disabled={busy}
            >
              Restore bundled default
            </button>
          ) : null}
        </div>
      </div>

      {busy && progress > 0 ? (
        <div
          className="appearance-progress"
          role="progressbar"
          aria-label="Banner upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <i style={{ width: `${progress}%` }} />
          <span>{Math.round(progress)}%</span>
        </div>
      ) : null}

      <div className="appearance-preview-grid">
        <Preview label="Desktop preview" className="appearance-preview-desktop" url={imageUrl} />
        <Preview label="Mobile preview" className="appearance-preview-mobile" url={imageUrl} />
      </div>
      <p className="appearance-file-note">
        {appearance.isDefault
          ? "Using the bundled arcane archive banner."
          : `${appearance.originalName ?? "Custom banner"} · ${formatBytes(
              appearance.sizeBytes ?? 0,
            )}`}
      </p>
    </section>
  );
}

function Preview({
  label,
  className,
  url,
}: {
  label: string;
  className: string;
  url: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <div
        className={`appearance-preview ${className}`}
        style={{ backgroundImage: `url("${url}")` }}
      >
        <div className="appearance-search-mock" aria-hidden="true">
          <span>Search modules, classes, authors, or tags</span>
          <b>Search the archive</b>
        </div>
      </div>
    </div>
  );
}

function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid image."));
    };
    image.src = url;
  });
}

function safeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-120);
}

function formatBytes(bytes: number): string {
  if (!bytes) return "size unavailable";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
