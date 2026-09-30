import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api/respond";
import { getCurrentUser } from "@/lib/auth/guards";
import { assertBookingAccess } from "@/lib/booking/access";
import { NotFoundError } from "@/lib/errors";
import { findReceiptByNumber, receiptPdfBytes } from "@/lib/receipts/service";
import { receiptNumberSchema } from "@/lib/validation/booking";

export const runtime = "nodejs";

/**
 * GET /api/receipts/:number/pdf?e=<guestEmail>
 * Streams the receipt PDF. Access follows the same rule as booking pages: owner session,
 * matching account email, guest-email hint, or admin. Rendered from the frozen snapshot,
 * so no public storage URL is ever needed.
 */
export const GET = handleRoute(async (req: NextRequest, ctx: { params: Promise<{ number: string }> }) => {
  const { number } = await ctx.params;
  const parsed = receiptNumberSchema.safeParse(number);
  if (!parsed.success) throw new NotFoundError("Receipt not found.");
  const receipt = await findReceiptByNumber(parsed.data);
  if (!receipt) throw new NotFoundError("Receipt not found.");
  assertBookingAccess(receipt.booking, await getCurrentUser(), req.nextUrl.searchParams.get("e"));

  const pdf = await receiptPdfBytes(receipt);
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${receipt.receiptNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
