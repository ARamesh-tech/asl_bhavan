import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AppError, GENERIC_ERROR_MESSAGE, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Uniform JSON envelope for all API routes.
 *
 *   success: { ok: true,  data }
 *   failure: { ok: false, error: { code, message, details? } }
 *
 * `handleRoute` wraps a handler so every thrown error becomes a safe response.
 */

import type { ApiFailure, ApiSuccess } from "./types";
export type { ApiFailure, ApiResponse, ApiSuccess } from "./types";

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function fail(error: AppError): NextResponse<ApiFailure> {
  return NextResponse.json(
    { ok: false as const, error: { code: error.code, message: error.message, ...(error.details !== undefined ? { details: error.details } : {}) } },
    { status: error.status },
  );
}

/** Convert Zod issues into a `{ field: message }` map for forms. */
export function zodToFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return new ValidationError(undefined, zodToFieldErrors(err));
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return new AppError("CONFLICT", "A record with these details already exists.", 409);
    }
    if (err.code === "P2025") {
      return new AppError("NOT_FOUND", "The requested record was not found.", 404);
    }
  }
  if (err instanceof SyntaxError) {
    return new ValidationError("The request body is not valid JSON.");
  }
  return new AppError("INTERNAL_ERROR", GENERIC_ERROR_MESSAGE, 500);
}

type Handler<Ctx> = (req: NextRequest, ctx: Ctx) => Promise<Response>;

export function handleRoute<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      const appErr = toAppError(err);
      if (appErr.status >= 500) {
        logger.error("Unhandled API error", { path: req.nextUrl.pathname, err });
      } else if (appErr.status === 409 || appErr.status === 402) {
        logger.warn("API business error", { path: req.nextUrl.pathname, code: appErr.code, message: appErr.message });
      }
      return fail(appErr);
    }
  };
}

/** Parse and validate a JSON body; throws ValidationError with field errors on failure. */
export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ValidationError("The request body is not valid JSON.");
  }
  const result = schema.safeParse(json);
  if (!result.success) throw new ValidationError(undefined, zodToFieldErrors(result.error));
  return result.data;
}

/** Parse and validate URL search params. */
export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const obj: Record<string, string | string[]> = {};
  for (const [k, v] of req.nextUrl.searchParams.entries()) {
    const existing = obj[k];
    if (existing === undefined) obj[k] = v;
    else obj[k] = Array.isArray(existing) ? [...existing, v] : [existing, v];
  }
  const result = schema.safeParse(obj);
  if (!result.success) throw new ValidationError(undefined, zodToFieldErrors(result.error));
  return result.data;
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]!.trim() : req.headers.get("x-real-ip")) || "unknown";
}
