import {
  Bath,
  BedDouble,
  Car,
  CigaretteOff,
  DoorOpen,
  Droplets,
  GlassWater,
  Lock,
  Shirt,
  Snowflake,
  Sparkles,
  Sun,
  Tv,
  Wifi,
  Wind,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * Whitelisted icon names stored in the DB (Amenity.icon). Unknown names fall back to a
 * generic sparkle so an admin typo never breaks rendering.
 */
const ICONS: Record<string, ComponentType<LucideProps>> = {
  snowflake: Snowflake,
  wind: Wind,
  wifi: Wifi,
  "door-open": DoorOpen,
  bath: Bath,
  droplets: Droplets,
  tv: Tv,
  shirt: Shirt,
  car: Car,
  sun: Sun,
  "cigarette-off": CigaretteOff,
  sparkles: Sparkles,
  "glass-water": GlassWater,
  lock: Lock,
  "bed-double": BedDouble,
};

export const AMENITY_ICON_NAMES = Object.keys(ICONS);

export function AmenityIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && ICONS[name]) || Sparkles;
  return <Icon className={className} aria-hidden />;
}
