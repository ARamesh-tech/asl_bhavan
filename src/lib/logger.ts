/**
 * Minimal structured logger. Writes JSON lines in production (easy to ship from Render
 * logs) and readable output in development. Never log secrets — callers are responsible,
 * but common secret-looking keys are scrubbed defensively.
 */

type Level = "debug" | "info" | "warn" | "error";
type Meta = Record<string, unknown>;

const SENSITIVE = /pass|secret|token|signature|authorization|cookie|key$/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: process.env.NODE_ENV === "production" ? undefined : value.stack };
  }
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Meta = {};
    for (const [k, v] of Object.entries(value as Meta)) {
      out[k] = SENSITIVE.test(k) ? "[redacted]" : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

function emit(level: Level, message: string, meta?: Meta) {
  const payload = { level, time: new Date().toISOString(), message, ...(meta ? (scrub(meta) as Meta) : {}) };
  const line = process.env.NODE_ENV === "production" ? JSON.stringify(payload) : `[${level.toUpperCase()}] ${message}${meta ? " " + JSON.stringify(scrub(meta)) : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") {
    if (process.env.NODE_ENV !== "production") console.debug(line);
  } else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Meta) => emit("debug", message, meta),
  info: (message: string, meta?: Meta) => emit("info", message, meta),
  warn: (message: string, meta?: Meta) => emit("warn", message, meta),
  error: (message: string, meta?: Meta) => emit("error", message, meta),
};
