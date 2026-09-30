import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/guards";
import { assertBookingAccess } from "@/lib/booking/access";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { findReceiptByNumber } from "@/lib/receipts/service";
import type { ReceiptSnapshot } from "@/lib/receipts/snapshot";
import { receiptNumberSchema } from "@/lib/validation/booking";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Receipt", robots: { index: false } };

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const parsed = receiptNumberSchema.safeParse(number);
  if (!parsed.success) notFound();
  const emailHint = typeof sp.e === "string" ? sp.e : null;
  const [receipt, user] = await Promise.all([findReceiptByNumber(parsed.data), getCurrentUser()]);
  if (!receipt) notFound();
  try {
    assertBookingAccess(receipt.booking, user, emailHint);
  } catch (err) {
    if (isAppError(err)) notFound();
    throw err;
  }

  const s = receipt.snapshot as unknown as ReceiptSnapshot;
  const fmt = (v: number) => formatMoney(v, s.currency);
  const q = emailHint ? `?e=${encodeURIComponent(emailHint)}` : "";
  const pdfUrl = `/api/receipts/${encodeURIComponent(receipt.receiptNumber)}/pdf${q}`;

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receipt</p>
            <h1 className="font-mono text-3xl font-semibold tracking-tight">{s.receiptNumber}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Issued {s.issuedAtDisplay}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline"><a href={pdfUrl} target="_blank" rel="noopener noreferrer"><FileText aria-hidden /> View PDF</a></Button>
            <Button asChild><a href={`${pdfUrl}${q ? "&" : "?"}download=1`}><Download aria-hidden /> Download</a></Button>
          </div>
        </div>

        <article className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <header className="bg-brand px-6 py-6 text-brand-foreground">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xl font-semibold">{s.property.name}</p>
                <p className="mt-1 text-sm opacity-90">{s.property.addressLines.join(", ")}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">Booking {s.booking.reference}</p>
                <p className="opacity-90">{s.booking.roomName}</p>
              </div>
            </div>
          </header>

          <div className="grid gap-6 px-6 py-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billed to</p>
              <p className="mt-1 font-medium">{s.guest.name}</p>
              <p className="text-sm text-muted-foreground">{s.guest.email}</p>
              <p className="text-sm text-muted-foreground">{s.guest.phone}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stay</p>
              <p className="mt-1 text-sm">Check-in {s.booking.checkIn} ({s.property.checkInTime})</p>
              <p className="text-sm">Check-out {s.booking.checkOut} ({s.property.checkOutTime})</p>
              <p className="text-sm text-muted-foreground">{s.booking.nights} night{s.booking.nights === 1 ? "" : "s"} · {s.booking.guestCount} guest{s.booking.guestCount === 1 ? "" : "s"}</p>
            </div>
          </div>

          <div className="px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2 font-semibold">Description</th>
                  <th className="px-2 py-2 text-right font-semibold">Qty</th>
                  <th className="px-2 py-2 text-right font-semibold">Unit</th>
                  <th className="px-2 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.lineItems.map((li, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-2 py-2">{li.description}</td>
                    <td className="px-2 py-2 text-right">{li.quantity}</td>
                    <td className="px-2 py-2 text-right">{fmt(li.unitAmount)}</td>
                    <td className="px-2 py-2 text-right font-medium">{fmt(li.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto max-w-xs space-y-1.5 px-6 py-6 text-sm">
            <Row label="Room charges" value={fmt(s.totals.roomCharges)} />
            {s.totals.additionalCharges > 0 && <Row label="Additional charges" value={fmt(s.totals.additionalCharges)} />}
            {s.totals.discount > 0 && <Row label="Discount" value={`- ${fmt(s.totals.discount)}`} />}
            {s.totals.taxAmount > 0 && <Row label={`${s.totals.taxLabel} (${s.totals.taxRate}%)`} value={fmt(s.totals.taxAmount)} />}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{fmt(s.totals.totalAmount)}</dd>
            </div>
            <Row label="Paid" value={fmt(s.totals.amountPaid)} />
            <div className={`flex justify-between font-semibold ${s.totals.balanceDue > 0 ? "text-status-partial" : ""}`}>
              <dt>Balance due</dt>
              <dd>{fmt(s.totals.balanceDue)}</dd>
            </div>
          </dl>

          <div className="border-t px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payments</p>
            {s.payments.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No payments recorded.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {s.payments.map((p, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{p.date} · {p.methodLabel}{p.reference ? ` · Ref ${p.reference}` : ""}</span>
                    <span className="font-medium">{fmt(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted-foreground">Payment status: {s.paymentStatusLabel}. {s.footerNote}</p>
          </div>
        </article>

        <p className="mt-6 text-sm text-muted-foreground">
          <Link href={`/booking/${encodeURIComponent(receipt.booking.bookingReference)}${q}`} className="underline">Back to booking</Link>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
