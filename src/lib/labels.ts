import type { BookingSource, GalleryCategory, PaymentMethod, RoomBlockType } from "@/generated/prisma/client";

/** Human-readable labels for enums (client-safe; no server imports). */

export const GALLERY_CATEGORY_LABELS: Record<GalleryCategory, string> = {
  ROOMS: "Rooms",
  PROPERTY: "Property",
  EXTERIOR: "Exterior",
  FACILITIES: "Facilities",
  NEARBY_ATTRACTIONS: "Nearby attractions",
  EVENTS: "Events",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  RAZORPAY: "Online (Razorpay)",
  CASH: "Cash",
  DIRECT_UPI: "Direct UPI",
  BANK_TRANSFER: "Bank transfer",
  PAY_ON_ARRIVAL: "Pay on arrival",
  OTHER: "Other",
};

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  ONLINE: "Online",
  WHATSAPP: "WhatsApp",
  MANUAL: "Manual (admin)",
  PHONE: "Phone",
  WALK_IN: "Walk-in",
};

export const ROOM_BLOCK_TYPE_LABELS: Record<RoomBlockType, string> = {
  MAINTENANCE: "Maintenance",
  OWNER_USE: "Owner use",
  PRIVATE_EVENT: "Private event",
  OTHER: "Other",
};
