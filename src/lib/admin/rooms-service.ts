import "server-only";
import type { RoomBlockType } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { checkUnitAvailability } from "@/lib/booking/availability-service";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

type Actor = { adminUserId: string; ipAddress?: string | null };

/**
 * Room blocks make dates unavailable (maintenance, owner use, …). Creating a block that
 * overlaps existing confirmed bookings is refused — the admin must move/cancel those first.
 */
export async function createRoomBlock(
  input: { roomId: string; startDate: Date; endDate: Date; type: RoomBlockType; reason?: string | null; bedsBlocked?: number | null },
  actor: Actor,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${input.roomId} FOR UPDATE`;
    const room = await tx.room.findFirst({ where: { id: input.roomId, deletedAt: null }, select: { id: true, type: true, capacity: true, name: true } });
    if (!room) throw new NotFoundError("Room not found.");
    if (room.type !== "DORMITORY" && input.bedsBlocked) {
      throw new ValidationError("Bed counts only apply to the dormitory.");
    }
    if (room.type === "DORMITORY" && input.bedsBlocked && input.bedsBlocked > room.capacity) {
      throw new ValidationError(`The dormitory has ${room.capacity} beds.`);
    }

    // Would this block collide with bookings that already hold inventory?
    const needed = room.type === "DORMITORY" ? (input.bedsBlocked ?? room.capacity) : 1;
    const availability = await checkUnitAvailability(tx, { roomId: room.id, range: { start: input.startDate, end: input.endDate }, guestCount: needed });
    if (!availability.isAvailable && ["BOOKED", "INSUFFICIENT_BEDS"].includes(availability.reason ?? "")) {
      throw new ConflictError("Existing bookings overlap these dates. Move or cancel them before blocking.");
    }

    const block = await tx.roomBlock.create({
      data: {
        roomId: room.id,
        startDate: input.startDate,
        endDate: input.endDate,
        type: input.type,
        reason: input.reason?.trim() || null,
        bedsBlocked: room.type === "DORMITORY" ? input.bedsBlocked ?? null : null,
        createdById: actor.adminUserId,
      },
    });
    await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_BLOCKED_ROOM", entityType: "RoomBlock", entityId: block.id, newValue: { ...block, roomName: room.name }, ipAddress: actor.ipAddress }, tx);
    return block;
  });
}

export type RoomUpsertData = {
  name: string;
  slug: string;
  roomNumber?: string | null;
  type: "PRIVATE_ROOM" | "DORMITORY";
  category: string;
  shortDescription?: string | null;
  description: string;
  capacity: number;
  minGuests: number;
  maxGuests: number;
  basePrice: number;
  pricePerPerson?: number | null;
  weekendPrice?: number | null;
  bedConfiguration?: string | null;
  sizeSqFt?: number | null;
  floor?: string | null;
  rules?: string | null;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  amenityIds: string[];
};

export async function upsertRoom(id: string | null, data: RoomUpsertData, actor: Actor) {
  const { amenityIds, ...fields } = data;
  const row = {
    ...fields,
    roomNumber: fields.roomNumber || null,
    shortDescription: fields.shortDescription || null,
    pricePerPerson: data.type === "DORMITORY" ? data.pricePerPerson ?? data.basePrice : null,
    weekendPrice: data.weekendPrice ?? null,
    bedConfiguration: fields.bedConfiguration || null,
    sizeSqFt: fields.sizeSqFt ?? null,
    floor: fields.floor || null,
    rules: fields.rules || null,
  };
  return prisma.$transaction(async (tx) => {
    const clash = await tx.room.findFirst({ where: { slug: row.slug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (clash) throw new ValidationError("Another room already uses this slug.", { slug: "Already in use" });
    if (row.roomNumber) {
      const numClash = await tx.room.findFirst({ where: { roomNumber: row.roomNumber, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
      if (numClash) throw new ValidationError("Another room already uses this room number.", { roomNumber: "Already in use" });
    }
    const existing = id ? await tx.room.findFirst({ where: { id, deletedAt: null }, include: { amenities: true } }) : null;
    if (id && !existing) throw new NotFoundError("Room not found.");

    const saved = existing
      ? await tx.room.update({
          where: { id: existing.id },
          data: { ...row, amenities: { deleteMany: {}, create: amenityIds.map((amenityId) => ({ amenityId })) } },
        })
      : await tx.room.create({ data: { ...row, amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) } } });

    const priceChanged =
      existing &&
      (existing.basePrice.toNumber() !== data.basePrice ||
        (existing.pricePerPerson?.toNumber() ?? null) !== (row.pricePerPerson ?? null) ||
        (existing.weekendPrice?.toNumber() ?? null) !== (row.weekendPrice ?? null));

    await recordAudit(
      {
        adminUserId: actor.adminUserId,
        action: existing ? (priceChanged ? "ADMIN_CHANGED_PRICE" : "ADMIN_UPDATED_ROOM") : "ADMIN_CREATED_ROOM",
        entityType: "Room",
        entityId: saved.id,
        oldValue: existing ? { ...existing, amenities: existing.amenities.map((a) => a.amenityId) } : undefined,
        newValue: { ...saved, amenities: amenityIds },
        ipAddress: actor.ipAddress,
      },
      tx,
    );
    return saved;
  });
}

/** Soft delete; refused while future inventory-holding bookings exist. */
export async function softDeleteRoom(id: string, actor: Actor) {
  const room = await prisma.room.findFirst({ where: { id, deletedAt: null } });
  if (!room) throw new NotFoundError("Room not found.");
  const future = await prisma.booking.count({
    where: { roomId: id, deletedAt: null, status: { in: ["PENDING_PAYMENT", "OWNER_CONFIRMATION", "CONFIRMED", "CHECKED_IN"] }, checkOut: { gt: new Date() } },
  });
  if (future > 0) throw new ConflictError(`This unit has ${future} active booking(s). Cancel or move them first.`);
  await prisma.$transaction(async (tx) => {
    await tx.room.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, status: "INACTIVE" } });
    await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_DELETED_ROOM", entityType: "Room", entityId: id, oldValue: room, ipAddress: actor.ipAddress }, tx);
  });
}

export async function addRoomImage(roomId: string, input: { url: string; alt?: string | null; caption?: string | null; isPrimary: boolean; storageKey?: string | null }, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const room = await tx.room.findFirst({ where: { id: roomId, deletedAt: null }, select: { id: true, _count: { select: { images: true } } } });
    if (!room) throw new NotFoundError("Room not found.");
    const makePrimary = input.isPrimary || room._count.images === 0;
    if (makePrimary) await tx.roomImage.updateMany({ where: { roomId }, data: { isPrimary: false } });
    const image = await tx.roomImage.create({
      data: { roomId, url: input.url, storageKey: input.storageKey ?? null, alt: input.alt || null, caption: input.caption || null, isPrimary: makePrimary, sortOrder: room._count.images },
    });
    await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_UPDATED_ROOM", entityType: "RoomImage", entityId: image.id, newValue: image, ipAddress: actor.ipAddress }, tx);
    return image;
  });
}

export async function setPrimaryRoomImage(imageId: string, actor: Actor) {
  const image = await prisma.roomImage.findUnique({ where: { id: imageId } });
  if (!image) throw new NotFoundError("Image not found.");
  await prisma.$transaction([
    prisma.roomImage.updateMany({ where: { roomId: image.roomId }, data: { isPrimary: false } }),
    prisma.roomImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
  ]);
  await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_UPDATED_ROOM", entityType: "RoomImage", entityId: imageId, newValue: { isPrimary: true }, ipAddress: actor.ipAddress });
}

export async function deleteRoomImage(imageId: string, actor: Actor) {
  const image = await prisma.roomImage.findUnique({ where: { id: imageId } });
  if (!image) throw new NotFoundError("Image not found.");
  await prisma.$transaction(async (tx) => {
    await tx.roomImage.delete({ where: { id: imageId } });
    if (image.isPrimary) {
      const next = await tx.roomImage.findFirst({ where: { roomId: image.roomId }, orderBy: { sortOrder: "asc" } });
      if (next) await tx.roomImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_UPDATED_ROOM", entityType: "RoomImage", entityId: imageId, oldValue: image, ipAddress: actor.ipAddress }, tx);
  });
  return image;
}

export async function deleteRoomBlock(blockId: string, actor: Actor) {
  const block = await prisma.roomBlock.findUnique({ where: { id: blockId } });
  if (!block) throw new NotFoundError("Block not found.");
  await prisma.$transaction([
    prisma.roomBlock.delete({ where: { id: blockId } }),
    prisma.auditLog.create({
      data: { adminUserId: actor.adminUserId, action: "ADMIN_REMOVED_BLOCK", entityType: "RoomBlock", entityId: blockId, oldValue: JSON.parse(JSON.stringify(block)), ipAddress: actor.ipAddress ?? null },
    }),
  ]);
}

export async function upsertRoomPrice(
  input: { id?: string; roomId: string; startDate: Date; endDate: Date; price: number; pricePerPerson?: number | null; priority: number; reason?: string | null },
  actor: Actor,
) {
  const room = await prisma.room.findFirst({ where: { id: input.roomId, deletedAt: null }, select: { id: true, type: true } });
  if (!room) throw new NotFoundError("Room not found.");
  const data = {
    roomId: room.id,
    startDate: input.startDate,
    endDate: input.endDate,
    price: input.price,
    pricePerPerson: room.type === "DORMITORY" ? input.pricePerPerson ?? input.price : null,
    priority: input.priority,
    reason: input.reason?.trim() || null,
    createdById: actor.adminUserId,
  };
  const existing = input.id ? await prisma.roomPrice.findUnique({ where: { id: input.id } }) : null;
  const saved = existing
    ? await prisma.roomPrice.update({ where: { id: existing.id }, data })
    : await prisma.roomPrice.create({ data });
  await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_UPDATED_PRICE_OVERRIDE", entityType: "RoomPrice", entityId: saved.id, oldValue: existing ?? undefined, newValue: saved, ipAddress: actor.ipAddress });
  return saved;
}

export async function deleteRoomPrice(id: string, actor: Actor) {
  const existing = await prisma.roomPrice.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Price override not found.");
  await prisma.roomPrice.delete({ where: { id } });
  await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_REMOVED_PRICE_OVERRIDE", entityType: "RoomPrice", entityId: id, oldValue: existing, ipAddress: actor.ipAddress });
}
