export class DownloadDeliveryError extends Error {
  constructor(public stage: "storage" | "tracking") {
    super(
      stage === "storage"
        ? "The download link could not be prepared. Please try again later."
        : "The download could not be recorded. Please try again later.",
    );
  }
  get status() {
    return this.stage === "storage" ? 502 : 503;
  }
}

// Call only after file validation and authorization. HEAD requests do not count.
export async function prepareTrackedDownload(input: {
  createUrl: () => Promise<string>;
  record: () => Promise<void>;
  track?: boolean;
}) {
  let url: string;
  try {
    url = await input.createUrl();
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("Invalid download URL");
  } catch {
    throw new DownloadDeliveryError("storage");
  }
  if (input.track !== false) {
    try {
      await input.record();
    } catch {
      throw new DownloadDeliveryError("tracking");
    }
  }
  return url;
}

export function downloadErrorResponse(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof DownloadDeliveryError
          ? error.message
          : "The download could not be completed. Please try again later.",
    },
    {
      status: error instanceof DownloadDeliveryError ? error.status : 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
