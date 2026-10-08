type Transport = {
  fetch: typeof fetch;
  pause: (milliseconds: number) => Promise<void>;
};

/** Bounded retries apply only to read requests, never OAuth or external writes. */
export async function patreonRead(
  url: string | URL,
  token: string,
  transport: Transport = {
    fetch,
    pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  },
): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await transport.fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      if (attempt === 2)
        throw new Error("Patreon could not be reached. Please retry later.");
      await transport.pause(250 * 2 ** attempt);
      continue;
    }
    if (response.ok) return response;
    if (attempt < 2 && [429, 502, 503, 504].includes(response.status)) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await response.body?.cancel();
      await transport.pause(
        Math.min(
          5000,
          Math.max(
            250 * 2 ** attempt,
            Number.isFinite(retryAfter) ? retryAfter * 1000 : 0,
          ),
        ),
      );
      continue;
    }
    await response.body?.cancel();
    throw new Error(`Patreon returned ${response.status}.`);
  }
  throw new Error("Patreon could not be reached.");
}
