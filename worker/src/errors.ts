import type { Context } from "hono";

export interface ApiError {
  ok: false;
  error: { code: string; message: string };
}

export function apiError(code: string, message: string): ApiError {
  return { ok: false, error: { code, message } };
}

/** Hono helper: respond with a JSON error envelope and status. */
export function jsonError(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 426 | 429 | 500,
  code: string,
  message: string,
) {
  return c.json(apiError(code, message), status);
}
