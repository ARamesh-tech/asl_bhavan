/**
 * Frozen receipt content. Stored as JSON on the Receipt row and used for both the PDF and
 * the HTML view, so a receipt never changes retroactively.
 */
export type ReceiptSnapshot = {
  version: 1;
  receiptNumber: string;
  issuedAt: string;
  issuedAtDisplay: string;
  currency: string;
  currencySymbol: string;
  property: {
    name: string;
    addressLines: string[];
    phone: string;
    email: string;
    website: string;
    checkInTime: string;
    checkOutTime: string;
  };
  guest: { name: string; email: string; phone: string };
  booking: {
    reference: string;
    roomName: string;
    roomType: "PRIVATE_ROOM" | "DORMITORY";
    checkIn: string;
    checkOut: string;
    nights: number;
    guestCount: number;
    status: string;
  };
  lineItems: Array<{ description: string; quantity: number; unitAmount: number; amount: number }>;
  totals: {
    roomCharges: number;
    additionalCharges: number;
    discount: number;
    taxRate: number;
    taxLabel: string;
    taxAmount: number;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
  };
  payments: Array<{ date: string; methodLabel: string; reference: string | null; amount: number; status: string }>;
  paymentStatusLabel: string;
  footerNote: string;
};
