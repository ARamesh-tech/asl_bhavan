import { formatMoney } from "@/lib/money";

export type PriceSummaryProps = {
  currency: string;
  nights: number;
  guestCount: number;
  units?: number;
  isDormitory: boolean;
  roomCharges: number;
  additionalCharges?: number;
  discount?: number;
  taxRate: number;
  taxLabel?: string;
  taxAmount: number;
  totalAmount: number;
  amountPaid?: number;
  perNight?: Array<{ date: string; unitPrice: number; amount: number; source: "BASE" | "WEEKEND" | "OVERRIDE"; reason?: string }>;
  className?: string;
};

export function PriceSummary(p: PriceSummaryProps) {
  const fmt = (v: number) => formatMoney(v, p.currency);
  const balance = p.amountPaid !== undefined ? Math.max(0, p.totalAmount - p.amountPaid) : null;
  return (
    <dl className={`space-y-2 text-sm ${p.className ?? ""}`}>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">
          Room charges · {p.nights} night{p.nights === 1 ? "" : "s"}
          {p.isDormitory ? ` × ${p.units ?? p.guestCount} bed${(p.units ?? p.guestCount) === 1 ? "" : "s"}` : ""}
        </dt>
        <dd className="font-medium">{fmt(p.roomCharges)}</dd>
      </div>
      {p.perNight && p.perNight.length > 1 && (
        <details className="rounded-lg bg-muted/40 px-3 py-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">Nightly breakdown</summary>
          <ul className="mt-2 space-y-1 text-xs">
            {p.perNight.map((n) => (
              <li key={n.date} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {n.date}
                  {n.source === "WEEKEND" ? " · weekend" : n.source === "OVERRIDE" ? ` · ${n.reason ?? "special rate"}` : ""}
                </span>
                <span>{fmt(n.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!!p.additionalCharges && p.additionalCharges > 0 && (
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Additional charges</dt><dd className="font-medium">{fmt(p.additionalCharges)}</dd></div>
      )}
      {!!p.discount && p.discount > 0 && (
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Discount</dt><dd className="font-medium text-status-available">− {fmt(p.discount)}</dd></div>
      )}
      {p.taxAmount > 0 && (
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{p.taxLabel ?? "Tax"} ({p.taxRate}%)</dt><dd className="font-medium">{fmt(p.taxAmount)}</dd></div>
      )}
      <div className="flex justify-between gap-4 border-t pt-3 text-base">
        <dt className="font-semibold">Total</dt>
        <dd className="font-semibold text-brand-deep">{fmt(p.totalAmount)}</dd>
      </div>
      {balance !== null && (
        <>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Paid</dt><dd>{fmt(p.amountPaid ?? 0)}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Balance due</dt><dd className={balance > 0 ? "font-medium text-status-partial" : "font-medium text-status-available"}>{fmt(balance)}</dd></div>
        </>
      )}
    </dl>
  );
}
