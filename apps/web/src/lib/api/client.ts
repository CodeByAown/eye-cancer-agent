/**
 * Thin, typed API client over fetch.
 *
 * - Base URL from NEXT_PUBLIC_API_URL.
 * - Parses the backend's `{ error: { code, message } }` envelope into ApiError.
 * - `getToken` hook lets auth (Clerk) inject a bearer token later without
 *   changing call sites; in dev the backend's DEV_AUTH_BYPASS makes it optional.
 */

import { config } from "@/lib/config";
import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type TokenGetter = () => string | null | Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

/** Register a bearer-token source (called by the auth layer). */
export function setAuthTokenGetter(getter: TokenGetter | null) {
  tokenGetter = getter;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = options;

  const url = new URL(`${config.apiUrl}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const finalHeaders = new Headers(headers);
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) finalHeaders.set("Content-Type", "application/json");

  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      ...rest,
      headers: finalHeaders,
      body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, "network_error", "Could not reach the API.", { cause: String(e) });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      err?.code ?? "http_error",
      err?.message ?? response.statusText,
      err?.details,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) =>
    request<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
