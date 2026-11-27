export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(`HTTP ${status}`);
  }
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  attempts = 3,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(12000),
      });
      if (response.ok || response.status === 201) return response;
      const header = response.headers.get('retry-after');
      const retryAfter =
        header === null
          ? undefined
          : /^\d+(?:\.\d+)?$/.test(header)
            ? Number(header)
            : Math.max(0, (Date.parse(header) - Date.now()) / 1000);
      if (response.status !== 429 && response.status < 500) {
        throw new HttpError(response.status);
      }
      lastError = new HttpError(
        response.status,
        retryAfter !== undefined && Number.isFinite(retryAfter)
          ? retryAfter
          : undefined,
      );
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.status !== 429 &&
        error.status < 500
      )
        throw error;
      lastError = error;
    }
    if (attempt < attempts - 1) {
      const seconds =
        lastError instanceof HttpError &&
        lastError.retryAfterSeconds !== undefined
          ? Math.min(lastError.retryAfterSeconds, 30)
          : 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    }
  }
  throw lastError;
}
