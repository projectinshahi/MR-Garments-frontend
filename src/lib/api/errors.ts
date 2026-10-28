import type { ApiErrorBody } from "./types";

/** A failed API request. `status` 0 means the request never got an answer (network failure, E12). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body?.error?.code) return new ApiError(response.status, body.error.code, body.error.message, body.error.fields);
  } catch {
    // Not the standard body (for example a proxy error page); fall through.
  }
  return new ApiError(response.status, "unexpected", "Something went wrong.");
}
