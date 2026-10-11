"use client";

import { useEffect, useRef, useState } from "react";
import type { FileKind } from "../../lib/domain/resource";
import {
  isArtworkKind,
  uploadResourceFile,
  type ArtworkKind,
  type ArtworkUrls,
  type UploadState,
} from "../../lib/client/resource-upload";

export function useResourceUploads(input: {
  resourceId?: string | null;
  resourceVersionId?: string | null;
  onStatus: (message: string) => void;
  onPreview: (kind: ArtworkKind, url: string) => void;
  onArtwork: (artwork: ArtworkUrls, kind: ArtworkKind) => void;
}) {
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const previews = useRef<Partial<Record<ArtworkKind, string>>>({});
  const active = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const urls = previews.current;
    return () => {
      mounted.current = false;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function uploadFile(
    kind: FileKind,
    file: File,
    locale: "en" | "es" = "en",
  ) {
    if (!input.resourceId || !input.resourceVersionId) {
      input.onStatus("Save this draft before uploading files.");
      return;
    }
    const artwork = isArtworkKind(kind);
    const key = artwork ? kind : `${locale}-${kind}`;
    if (active.current.has(key)) return;
    active.current.add(key);
    const state = (value: UploadState) => {
      if (mounted.current)
        setUploads((current) => ({ ...current, [key]: value }));
    };
    if (artwork) {
      const previous = previews.current[kind];
      if (previous) URL.revokeObjectURL(previous);
      const url = URL.createObjectURL(file);
      previews.current[kind] = url;
      input.onPreview(kind, url);
    }
    state({ phase: "uploading", progress: 1, fileName: file.name });
    input.onStatus(`Uploading ${file.name}…`);
    try {
      const result = await uploadResourceFile({
        resourceId: input.resourceId,
        resourceVersionId: input.resourceVersionId,
        kind,
        locale,
        file,
        onState: state,
      });
      if (!mounted.current) return;
      if (artwork && result.artwork) {
        input.onArtwork(result.artwork, kind);
        const url = previews.current[kind];
        if (url) URL.revokeObjectURL(url);
        delete previews.current[kind];
      }
      state({ phase: "complete", progress: 100, fileName: file.name });
      input.onStatus(`${file.name} saved.`);
      return result.url;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The upload failed. Please retry.";
      state({
        phase: "error",
        progress: 0,
        fileName: file.name,
        error: message,
      });
      if (mounted.current) input.onStatus(message);
    } finally {
      active.current.delete(key);
    }
  }
  return {
    uploads,
    uploadFile,
    busy: Object.values(uploads).some(
      (state) => state.phase === "uploading" || state.phase === "saving",
    ),
  };
}
