import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db/prisma";
import { defaultSettings, settingsGroups } from "../src/lib/settings/definitions";
import type { Prisma } from "../src/generated/prisma/client";

/**
 * Development / first-deploy seed.
 *
 *  - Idempotent: safe to run repeatedly. Existing rows are never overwritten.
 *  - Creates default settings documents, the amenity master list, and the 9 accommodation
 *    units (8 private rooms + 1 dormitory) with SAMPLE prices/capacities that the owner
 *    must edit in Admin → Rooms. These are NOT real ASL Bhavan tariffs.
 *  - Creates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD only if it does not exist.
 */

const AMENITIES: Array<{ name: string; icon: string; category: string }> = [
  { name: "Air conditioning", icon: "snowflake", category: "Comfort" },
  { name: "Free Wi-Fi", icon: "wifi", category: "Connectivity" },
  { name: "Private balcony", icon: "door-open", category: "Room" },
  { name: "Attached bathroom", icon: "bath", category: "Room" },
  { name: "Hot water", icon: "droplets", category: "Room" },
  { name: "Television", icon: "tv", category: "Room" },
  { name: "Wardrobe", icon: "shirt", category: "Room" },
  { name: "Free private parking", icon: "car", category: "Property" },
  { name: "Shared terrace", icon: "sun", category: "Property" },
  { name: "Non-smoking", icon: "cigarette-off", category: "Policy" },
  { name: "Housekeeping", icon: "sparkles", category: "Service" },
  { name: "Drinking water", icon: "glass-water", category: "Service" },
  { name: "Lockers", icon: "lock", category: "Dormitory" },
  { name: "Shared bathroom", icon: "bath", category: "Dormitory" },
];

type RoomSeed = {
  slug: string;
  name: string;
  roomNumber: string;
  type: "PRIVATE_ROOM" | "DORMITORY";
  category: string;
  shortDescription: string;
  description: string;
  capacity: number;
  minGuests: number;
  maxGuests: number;
  basePrice: number;
  pricePerPerson?: number;
  bedConfiguration: string;
  isFeatured?: boolean;
  amenities: string[];
};

const PRIVATE_AMENITIES = [
  "Air conditioning",
  "Free Wi-Fi",
  "Private balcony",
  "Attached bathroom",
  "Hot water",
  "Television",
  "Wardrobe",
  "Free private parking",
  "Non-smoking",
  "Housekeeping",
  "Drinking water",
];

// SAMPLE inventory. Names, prices and capacities are placeholders for the owner to edit.
const ROOMS: RoomSeed[] = [
  ...[1, 2, 3, 4].map<RoomSeed>((n) => ({
    slug: `room-${n}`,
    name: `Room ${n}`,
    roomNumber: `10${n}`,
    type: "PRIVATE_ROOM",
    category: "Deluxe AC Room",
    shortDescription: "Air-conditioned double room with a private balcony.",
    description:
      "A bright, air-conditioned double room with an attached bathroom, hot water, television and a private balcony. Ideal for couples or solo travellers. (Sample description — edit in Admin → Rooms.)",
    capacity: 2,
    minGuests: 1,
    maxGuests: 2,
    basePrice: 1800, // SAMPLE PRICE
    bedConfiguration: "1 double bed",
    isFeatured: n <= 2,
    amenities: PRIVATE_AMENITIES,
  })),
  ...[5, 6].map<RoomSeed>((n) => ({
    slug: `room-${n}`,
    name: `Room ${n}`,
    roomNumber: `20${n - 4}`,
    type: "PRIVATE_ROOM",
    category: "Family AC Room",
    shortDescription: "Spacious air-conditioned room for up to 4 guests.",
    description:
      "A spacious family room with one double bed and two single beds, attached bathroom, hot water, television and balcony access. (Sample description — edit in Admin → Rooms.)",
    capacity: 4,
    minGuests: 1,
    maxGuests: 4,
    basePrice: 2800, // SAMPLE PRICE
    bedConfiguration: "1 double bed + 2 single beds",
    isFeatured: n === 5,
    amenities: PRIVATE_AMENITIES,
  })),
  ...[7, 8].map<RoomSeed>((n) => ({
    slug: `room-${n}`,
    name: `Room ${n}`,
    roomNumber: `20${n - 4}`,
    type: "PRIVATE_ROOM",
    category: "Triple AC Room",
    shortDescription: "Comfortable air-conditioned room for up to 3 guests.",
    description:
      "An air-conditioned triple room with one double bed and one single bed, attached bathroom and hot water. (Sample description — edit in Admin → Rooms.)",
    capacity: 3,
    minGuests: 1,
    maxGuests: 3,
    basePrice: 2300, // SAMPLE PRICE
    bedConfiguration: "1 double bed + 1 single bed",
    amenities: PRIVATE_AMENITIES,
  })),
  {
    slug: "dormitory",
    name: "Dormitory",
    roomNumber: "D1",
    type: "DORMITORY",
    category: "Mixed Dormitory",
    shortDescription: "Budget-friendly beds in a shared, air-conditioned dormitory.",
    description:
      "Clean, air-conditioned dormitory with individual beds, lockers and shared bathrooms. Priced per bed, per night — book as many beds as you need. (Sample description — edit in Admin → Rooms.)",
    capacity: 10,
    minGuests: 1,
    maxGuests: 10,
    basePrice: 500, // SAMPLE PRICE — for dormitory this equals pricePerPerson
    pricePerPerson: 500, // SAMPLE PRICE
    bedConfiguration: "10 single beds",
    amenities: [
      "Air conditioning",
      "Free Wi-Fi",
      "Shared bathroom",
      "Lockers",
      "Hot water",
      "Free private parking",
      "Non-smoking",
      "Drinking water",
    ],
  },
];

async function seedSettings() {
  const defaults = defaultSettings();
  let created = 0;
  for (const group of settingsGroups) {
    const existing = await prisma.siteSetting.findUnique({ where: { key: group } });
    if (existing) continue;
    await prisma.siteSetting.create({
      data: {
        key: group,
        group,
        value: defaults[group] as unknown as Prisma.InputJsonValue,
      },
    });
    created++;
  }
  console.log(`Settings: ${created} group(s) created, ${settingsGroups.length - created} existing.`);
}

async function seedAmenities() {
  const existing = new Set(
    (await prisma.amenity.findMany({ select: { name: true } })).map((a) => a.name),
  );
  const missing = AMENITIES.filter((a) => !existing.has(a.name));
  if (missing.length > 0) {
    await prisma.amenity.createMany({
      data: missing.map((a) => ({ ...a, sortOrder: AMENITIES.indexOf(a) })),
    });
  }
  console.log(`Amenities: ${AMENITIES.length} ensured (${missing.length} new).`);
}

async function seedRooms() {
  const existingCount = await prisma.room.count();
  if (existingCount > 0) {
    console.log(`Rooms: ${existingCount} already exist — skipping sample inventory.`);
    return;
  }
  const amenities = await prisma.amenity.findMany();
  const amenityIdByName = new Map(amenities.map((a) => [a.name, a.id]));

  for (const [i, r] of ROOMS.entries()) {
    await prisma.room.create({
      data: {
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
        basePrice: r.basePrice,
        pricePerPerson: r.pricePerPerson ?? null,
        bedConfiguration: r.bedConfiguration,
        isFeatured: r.isFeatured ?? false,
        sortOrder: i,
        status: "ACTIVE",
        isActive: true,
        amenities: {
          create: r.amenities
            .map((name) => amenityIdByName.get(name))
            .filter((id): id is string => Boolean(id))
            .map((amenityId) => ({ amenityId })),
        },
      },
    });
  }
  console.log(`Rooms: created ${ROOMS.length} sample units (8 private rooms + 1 dormitory).`);
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "ASL Bhavan Admin";

  if (!email || !password) {
    console.log("Admin: ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin creation.");
    return;
  }
  if (password.length < 10) {
    throw new Error("ADMIN_PASSWORD must be at least 10 characters.");
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      console.log(`Admin: promoted existing user ${email} to ADMIN.`);
    } else {
      console.log(`Admin: ${email} already exists — skipping.`);
    }
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Admin: created ${email}.`);
}

async function main() {
  console.log("Seeding ASL Bhavan database…");
  await seedSettings();
  await seedAmenities();
  await seedRooms();
  await seedAdmin();
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
