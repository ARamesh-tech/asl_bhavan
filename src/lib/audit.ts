import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma, type DbClient } from "@/lib/db/prisma";

/**
 * Audit trail for admin actions. Values are JSON snapshots — callers must never pass
 * password hashes, session tokens or payment secrets (use `redact` on anything that might).
 */

export type AuditAction =
  | "ADMIN_CREATED_ROOM"
  | "ADMIN_UPDATED_ROOM"
  | "ADMIN_DELETED_ROOM"
  | "ADMIN_CHANGED_PRICE"
  | "ADMIN_BLOCKED_ROOM"
  | "ADMIN_UPDATED_BLOCK"
  | "ADMIN_REMOVED_BLOCK"
  | "ADMIN_CREATED_BOOKING"
  | "ADMIN_UPDATED_BOOKING"
  | "ADMIN_CONFIRMED_BOOKING"
  | "ADMIN_CANCELLED_BOOKING"
  | "ADMIN_DELETED_BOOKING"
  | "ADMIN_UPDATED_PRICE_OVERRIDE"
  | "ADMIN_REMOVED_PRICE_OVERRIDE"
  | "ADMIN_CHECKED_IN"
  | "ADMIN_CHECKED_OUT"
  | "ADMIN_MARKED_NO_SHOW"
  | "ADMIN_RECORDED_PAYMENT"
  | "ADMIN_GENERATED_RECEIPT"
  | "ADMIN_SENT_RECEIPT"
  | "ADMIN_UPDATED_SETTINGS"
  | "ADMIN_UPDATED_POST"
  | "ADMIN_DELETED_POST"
  | "ADMIN_SYNCED_INSTAGRAM"
  | "ADMIN_UPDATED_GALLERY"
  | "ADMIN_UPDATED_USER"
  | "ADMIN_UPDATED_MESSAGE"
  | "ADMIN_REFUNDED_PAYMENT"
  | "ADMIN_RETRIED_EMAIL"
  | "SYSTEM_EXPIRED_BOOKING"
  | "SYSTEM_PAYMENT_CONFIRMED"
  | "SYSTEM_PAYMENT_FAILED"
  | "SYSTEM_PAYMENT_REFUNDED"
  | "SYSTEM_PAYMENT_NEEDS_ATTENTION";

export type AuditEntry = {
  adminUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

const SENSITIVE_KEYS = /pass|secret|token|signature|hash|authorization|cookie/i;

/** Deep-copy `value` replacing any sensitive-looking keys with "[redacted]". */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    if (typeof (value as { toNumber?: unknown }).toNumber === "function") {
      return (value as { toNumber(): number }).toNumber();
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.test(k) ? "[redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

export async function recordAudit(entry: AuditEntry, db: DbClient = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      adminUserId: entry.adminUserId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      oldValue:
        entry.oldValue === undefined ? undefined : (redact(entry.oldValue) as Prisma.InputJsonValue),
      newValue:
        entry.newValue === undefined ? undefined : (redact(entry.newValue) as Prisma.InputJsonValue),
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
