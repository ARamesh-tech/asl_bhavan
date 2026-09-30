/**
 * Application error hierarchy.
 *
 * Services throw AppError subclasses with a stable `code` and a user-safe `message`.
 * The API layer (`src/lib/api/respond.ts`) maps them to HTTP responses; anything that is
 * NOT an AppError is logged server-side and returned as a generic 500 so stack traces,
 * Prisma codes and secrets never leak to the browser.
 */

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "UNAVAILABLE"
  | "RATE_LIMITED"
  | "PAYMENT_ERROR"
  | "INTEGRATION_DISABLED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Please check the highlighted fields and try again.", details?: unknown) {
    super("VALIDATION_ERROR", message, 400, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "We couldn't find what you were looking for.") {
    super("NOT_FOUND", message, 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super("UNAUTHORIZED", message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "This action conflicts with the current state. Please refresh and try again.") {
    super("CONFLICT", message, 409);
    this.name = "ConflictError";
  }
}

/** Room/beds not available for the requested dates. */
export class UnavailableError extends AppError {
  constructor(
    message = "Sorry, this accommodation is no longer available for the selected dates.",
    details?: unknown,
  ) {
    super("UNAVAILABLE", message, 409, details);
    this.name = "UnavailableError";
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Too many requests. Please wait a moment and try again.") {
    super("RATE_LIMITED", message, 429);
    this.name = "RateLimitedError";
  }
}

export class PaymentError extends AppError {
  constructor(message = "Sorry, the payment could not be processed. Please try again.", details?: unknown) {
    super("PAYMENT_ERROR", message, 402, details);
    this.name = "PaymentError";
  }
}

export class IntegrationDisabledError extends AppError {
  constructor(integration: string) {
    super(
      "INTEGRATION_DISABLED",
      `${integration} is not configured yet. Please contact the property owner.`,
      503,
    );
    this.name = "IntegrationDisabledError";
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/** Generic message for unexpected failures (never expose internals). */
export const GENERIC_ERROR_MESSAGE =
  "Sorry, something went wrong on our side. Please try again in a moment.";
