import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/errors";
import type { BookingWithRelations } from "./booking-service";

/**
 * Booking references are sequential (ASL-YYYYMMDD-A001) and therefore guessable, so a
 * reference alone never grants access. A customer may view a booking when:
 *   - they are signed in and own it (userId), or the account email matches, or
 *   - they supply the guest email used at booking time (post-checkout confirmation link).
 * Admins can always view. Failures return 404 to avoid confirming that a reference exists.
 */
export function assertBookingAccess(
  booking: Pick<BookingWithRelations, "userId" | "guestEmail">,
  user: SessionUser | null,
  emailHint: string | null | undefined,
): void {
  if (user && isAdmin(user)) return;
  if (user && (booking.userId === user.id || booking.guestEmail.toLowerCase() === user.email.toLowerCase())) return;
  if (emailHint && emailHint.trim().toLowerCase() === booking.guestEmail.toLowerCase()) return;
  throw new NotFoundError("Booking not found.");
}
