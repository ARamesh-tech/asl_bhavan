import "server-only";
import { publicEnv } from "@/lib/env";
import { getSettingsGroup } from "@/lib/settings/service";
import type { EmailBranding } from "./templates";

export async function emailBranding(): Promise<EmailBranding> {
  const [property, content] = await Promise.all([getSettingsGroup("property"), getSettingsGroup("content")]);
  return {
    propertyName: property.name,
    siteUrl: publicEnv.siteUrl,
    supportEmail: property.email || undefined,
    phone: property.phone || undefined,
    footerText: content.footerText || undefined,
  };
}
