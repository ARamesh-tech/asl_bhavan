import "server-only";
import { cache } from "react";
import { prisma, type DbClient } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import {
  type AllSettings,
  type SettingsGroup,
  parseSettingsGroup,
  settingsGroups,
  settingsSchemas,
} from "./definitions";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Settings service — the single access path for property/website configuration.
 *
 * Reads are memoised per request with React `cache` (not across requests), so an admin
 * change is visible on the very next request without any manual cache busting.
 */

async function loadAll(db: DbClient = prisma): Promise<AllSettings> {
  let rows: Array<{ key: string; value: unknown }> = [];
  try {
    rows = await db.siteSetting.findMany({ where: { key: { in: settingsGroups } } });
  } catch (err) {
    // Keep the public site rendering (with defaults) if the DB is briefly unreachable or
    // during a build without DATABASE_URL. Real pages that need data will still surface errors.
    logger.error("Failed to load site settings; using defaults", { err });
  }
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    property: parseSettingsGroup("property", byKey.get("property")),
    policies: parseSettingsGroup("policies", byKey.get("policies")),
    content: parseSettingsGroup("content", byKey.get("content")),
    booking: parseSettingsGroup("booking", byKey.get("booking")),
    notifications: parseSettingsGroup("notifications", byKey.get("notifications")),
  };
}

export const getSettings = cache(async (): Promise<AllSettings> => loadAll());

export async function getSettingsGroup<G extends SettingsGroup>(
  group: G,
  db?: DbClient,
): Promise<AllSettings[G]> {
  if (!db) {
    const all = await getSettings();
    return all[group];
  }
  const row = await db.siteSetting.findUnique({ where: { key: group } });
  return parseSettingsGroup(group, row?.value);
}

export async function updateSettingsGroup<G extends SettingsGroup>(
  group: G,
  patch: Partial<AllSettings[G]>,
  updatedById: string | null,
  db: DbClient = prisma,
): Promise<AllSettings[G]> {
  const current = await getSettingsGroup(group, db);
  const merged = settingsSchemas[group].parse({ ...current, ...patch });
  await db.siteSetting.upsert({
    where: { key: group },
    create: {
      key: group,
      group,
      value: merged as Prisma.InputJsonValue,
      updatedById,
    },
    update: { value: merged as Prisma.InputJsonValue, updatedById },
  });
  return merged as AllSettings[G];
}
