export type ApiFailure = { error?: string; errors?: Record<string, string> };

export async function fetchApi(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
    });
    if (response.status === 204) return response;
    const body = await response
      .clone()
      .json()
      .catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "The server returned an unreadable response. Please retry." },
        { status: 502 },
      );
    }
    return response;
  } catch {
    return Response.json(
      {
        error:
          "The connection was interrupted. Your changes are still here; please retry.",
      },
      { status: 503 },
    );
  }
}

/** Same-origin requests retain the browser's authenticated session. */
export async function requestJson<T extends ApiFailure>(
  url: string,
  options?: RequestInit,
): Promise<{ ok: boolean; body: T }> {
  try {
    const response = await fetchApi(url, options);
    if (response.status === 204) return { ok: true, body: {} as T };
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return {
        ok: false,
        body: {
          error: "The server returned an unreadable response. Please retry.",
        } as T,
      };
    }
    return { ok: response.ok, body: body as T };
  } catch {
    return {
      ok: false,
      body: {
        error:
          "The connection was interrupted. Your changes are still here; please retry.",
      } as T,
    };
  }
}
