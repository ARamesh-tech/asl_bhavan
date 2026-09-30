import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const publicRoomSelect = {
  id: true,
  slug: true,
  name: true,
  roomNumber: true,
  type: true,
  category: true,
  shortDescription: true,
  description: true,
  capacity: true,
  minGuests: true,
  maxGuests: true,
  basePrice: true,
  pricePerPerson: true,
  weekendPrice: true,
  bedConfiguration: true,
  sizeSqFt: true,
  floor: true,
  rules: true,
  isFeatured: true,
  sortOrder: true,
  status: true,
  images: { orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }], select: { id: true, url: true, alt: true, caption: true, isPrimary: true } },
  amenities: { select: { amenity: { select: { id: true, name: true, icon: true, category: true } } }, orderBy: { amenity: { sortOrder: "asc" as const } } },
} satisfies Prisma.RoomSelect;

type RoomRow = Prisma.RoomGetPayload<{ select: typeof publicRoomSelect }>;

/** Serialisable public shape (Decimals → numbers) safe to pass to client components. */
export type PublicRoom = {
  id: string;
  slug: string;
  name: string;
  roomNumber: string | null;
  type: "PRIVATE_ROOM" | "DORMITORY";
  category: string;
  shortDescription: string | null;
  description: string;
  capacity: number;
  minGuests: number;
  maxGuests: number;
  basePrice: number;
  pricePerPerson: number | null;
  weekendPrice: number | null;
  /** Price to show on cards: per night (private) or per bed per night (dormitory). */
  displayPrice: number;
  priceUnit: "night" | "person / night";
  bedConfiguration: string | null;
  sizeSqFt: number | null;
  floor: string | null;
  rules: string | null;
  isFeatured: boolean;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  images: Array<{ id: string; url: string; alt: string | null; caption: string | null; isPrimary: boolean }>;
  amenities: Array<{ id: string; name: string; icon: string | null; category: string | null }>;
};

export function toPublicRoom(r: RoomRow): PublicRoom {
  const isDorm = r.type === "DORMITORY";
  const perPerson = r.pricePerPerson ? r.pricePerPerson.toNumber() : null;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    roomNumber: r.roomNumber,
    type: r.type,
    category: r.category,
    shortDescription: r.shortDescription,
    description: r.description,
    capacity: r.capacity,
    minGuests: r.minGuests,
    maxGuests: r.maxGuests,
    basePrice: r.basePrice.toNumber(),
    pricePerPerson: perPerson,
    weekendPrice: r.weekendPrice ? r.weekendPrice.toNumber() : null,
    displayPrice: isDorm ? (perPerson ?? r.basePrice.toNumber()) : r.basePrice.toNumber(),
    priceUnit: isDorm ? "person / night" : "night",
    bedConfiguration: r.bedConfiguration,
    sizeSqFt: r.sizeSqFt,
    floor: r.floor,
    rules: r.rules,
    isFeatured: r.isFeatured,
    status: r.status,
    images: r.images,
    amenities: r.amenities.map((a) => a.amenity),
  };
}

export async function getPublicRooms(opts?: { featuredOnly?: boolean; limit?: number }): Promise<PublicRoom[]> {
  const rows = await prisma.room.findMany({
    where: { deletedAt: null, isActive: true, ...(opts?.featuredOnly ? { isFeatured: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: opts?.limit,
    select: publicRoomSelect,
  });
  return rows.map(toPublicRoom);
}

export async function getPublicRoomBySlug(slug: string): Promise<PublicRoom | null> {
  const row = await prisma.room.findFirst({
    where: { slug, deletedAt: null, isActive: true },
    select: publicRoomSelect,
  });
  return row ? toPublicRoom(row) : null;
}

export async function getPropertyAmenities(): Promise<Array<{ id: string; name: string; icon: string | null; category: string | null }>> {
  return prisma.amenity.findMany({
    where: { rooms: { some: { room: { isActive: true, deletedAt: null } } } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, icon: true, category: true },
  });
}
