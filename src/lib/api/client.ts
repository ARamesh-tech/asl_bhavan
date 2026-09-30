"use client";

import type { ApiResponse } from "./types";

/**
 * Typed fetch wrapper for the browser. Unwraps the `{ ok, data | error }` envelope and
 * throws `ApiClientError` (with field-level details when present) on failure.
 */

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
  /** `{ field: message }` map when the server returned validation errors. */
  get fieldErrors(): Record<string, string> {
    return this.details && typeof this.details === "object" && !Array.isArray(this.details)
      ? (this.details as Record<string, string>)
      : {};
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(input, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    // non-JSON body
  }

  if (!payload) {
    throw new ApiClientError("INTERNAL_ERROR", "Unexpected response from the server.", res.status);
  }
  if (!payload.ok) {
    throw new ApiClientError(payload.error.code, payload.error.message, res.status, payload.error.details);
  }
  return payload.data;
}
