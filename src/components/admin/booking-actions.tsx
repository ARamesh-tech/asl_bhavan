"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { BookingStatus } from "@/generated/prisma/client";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { PAYMENT_STATUS_LABELS } from "@/lib/booking/status";
import { MANUAL_PAYMENT_STATUS_OPTIONS, PAYMENT_METHODS } from "@/lib/validation/admin";

type Props = {
  bookingId: string;
  status: BookingStatus;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  guestEmail: string;
};

const selectCls = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

function useAction(bookingId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function run(label: string, body: Record<string, unknown>, onDone?: () => void) {
    setBusy(label);
    try {
      await apiFetch(`/api/admin/bookings/${bookingId}/actions`, { method: "POST", json: body });
      toast.success(`${label} done`);
      onDone?.();
      router.refresh();
    } catch (err) {
      const msg = err instanceof ApiClientError ? Object.values(err.fieldErrors)[0] ?? err.message : err instanceof Error ? err.message : "Action failed";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }
  return { run, busy };
}

export function BookingActions(p: Props) {
  const { run, busy } = useAction(p.bookingId);
  const router = useRouter();
  const balance = Math.max(0, p.totalAmount - p.amountPaid);
  const can = {
    confirm: ["OWNER_CONFIRMATION", "PENDING_PAYMENT", "EXPIRED", "DRAFT"].includes(p.status),
    checkIn: p.status === "CONFIRMED" || p.status === "NO_SHOW",
    checkOut: p.status === "CHECKED_IN",
    noShow: p.status === "CONFIRMED",
    cancel: ["PENDING_PAYMENT", "OWNER_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "DRAFT"].includes(p.status),
    payment: balance > 0 && ["OWNER_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "PENDING_PAYMENT"].includes(p.status),
    delete: ["CANCELLED", "EXPIRED", "NO_SHOW", "CHECKED_OUT", "DRAFT"].includes(p.status),
  };

  return (
    <div className="flex flex-wrap gap-2">
      {can.confirm && <ConfirmDialog p={p} busy={busy} run={run} />}
      {can.checkIn && (
        <Button onClick={() => run("Check-in", { action: "CHECK_IN" })} disabled={!!busy}>{busy === "Check-in" && <Loader2 className="animate-spin" aria-hidden />} Check in</Button>
      )}
      {can.checkOut && (
        <Button onClick={() => run("Check-out", { action: "CHECK_OUT" })} disabled={!!busy}>{busy === "Check-out" && <Loader2 className="animate-spin" aria-hidden />} Check out</Button>
      )}
      {can.payment && <PaymentDialog p={p} balance={balance} busy={busy} run={run} />}
      {can.noShow && (
        <Button variant="outline" onClick={() => run("No-show", { action: "NO_SHOW" })} disabled={!!busy}>Mark no-show</Button>
      )}
      {can.cancel && <CancelDialog busy={busy} run={run} />}
      {can.delete && (
        <ActionDialog
          trigger={<Button variant="ghost" className="text-destructive hover:text-destructive" disabled={!!busy}>Delete</Button>}
          title="Delete this booking?"
          description="It will be hidden from all lists and reports but kept for audit purposes. This cannot be undone from the UI."
          confirmLabel="Delete booking"
          destructive
          busy={busy === "Delete"}
          onConfirm={(close) => run("Delete", { action: "DELETE" }, () => { close(); router.push("/admin/bookings"); })}
        />
      )}
    </div>
  );
}

function ActionDialog({
  trigger, title, description, children, confirmLabel, destructive, busy, onConfirm,
}: {
  trigger: ReactNode; title: string; description?: string; children?: ReactNode; confirmLabel: string; destructive?: boolean; busy: boolean; onConfirm: (close: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Back</Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={() => onConfirm(() => setOpen(false))} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({ p, busy, run }: { p: Props; busy: string | null; run: ReturnType<typeof useAction>["run"] }) {
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("DIRECT_UPI");
  const [status, setStatus] = useState<(typeof MANUAL_PAYMENT_STATUS_OPTIONS)[number]>("DIRECT_UPI");
  const [amount, setAmount] = useState(String(Math.max(0, p.totalAmount - p.amountPaid)));
  const [txn, setTxn] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  return (
    <ActionDialog
      trigger={<Button disabled={!!busy}>{busy === "Confirm" && <Loader2 className="animate-spin" aria-hidden />} Confirm booking</Button>}
      title="Confirm booking"
      description="Record how the guest paid (or will pay). Availability is re-checked before confirming."
      confirmLabel="Confirm & save"
      busy={busy === "Confirm"}
      onConfirm={(close) =>
        run("Confirm", { action: "CONFIRM", paymentMethod: method, paymentStatus: status, amountReceived: Number(amount) || 0, transactionId: txn, paymentDate: date, notes, sendEmail }, close)
      }
    >
      <div className="grid gap-4 py-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cf-method">Payment method</Label>
            <select id="cf-method" className={selectCls} value={method} onChange={(e) => {
              const m = e.target.value as typeof method;
              setMethod(m);
              if (m === "CASH" || m === "DIRECT_UPI" || m === "BANK_TRANSFER" || m === "PAY_ON_ARRIVAL") setStatus(m);
              else setStatus("PAID");
            }}>
              {PAYMENT_METHODS.filter((m) => m !== "RAZORPAY").map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cf-status">Payment status</Label>
            <select id="cf-status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {MANUAL_PAYMENT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cf-amount">Amount received ({p.currency})</Label>
            <Input id="cf-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-xs text-muted-foreground">Total {p.totalAmount.toFixed(2)} · already paid {p.amountPaid.toFixed(2)}. Enter 0 for pay-on-arrival.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cf-date">Payment date</Label>
            <Input id="cf-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cf-txn">Transaction / UPI reference</Label>
          <Input id="cf-txn" value={txn} onChange={(e) => setTxn(e.target.value)} maxLength={100} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cf-notes">Notes</Label>
          <Textarea id="cf-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} /> Email confirmation to {p.guestEmail}</label>
      </div>
    </ActionDialog>
  );
}

function PaymentDialog({ p, balance, busy, run }: { p: Props; balance: number; busy: string | null; run: ReturnType<typeof useAction>["run"] }) {
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("CASH");
  const [amount, setAmount] = useState(String(balance));
  const [txn, setTxn] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <ActionDialog
      trigger={<Button variant="outline" disabled={!!busy}>Record payment</Button>}
      title="Record a payment"
      description={`Outstanding balance: ${balance.toFixed(2)} ${p.currency}`}
      confirmLabel="Save payment"
      busy={busy === "Payment"}
      onConfirm={(close) => run("Payment", { action: "RECORD_PAYMENT", amount: Number(amount), paymentMethod: method, transactionId: txn, paymentDate: date, notes }, close)}
    >
      <div className="grid gap-4 py-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="rp-amount">Amount ({p.currency})</Label>
            <Input id="rp-amount" type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rp-method">Method</Label>
            <select id="rp-method" className={selectCls} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              {PAYMENT_METHODS.filter((m) => m !== "RAZORPAY").map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="rp-txn">Reference</Label><Input id="rp-txn" value={txn} onChange={(e) => setTxn(e.target.value)} maxLength={100} /></div>
          <div className="grid gap-1.5"><Label htmlFor="rp-date">Date</Label><Input id="rp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="grid gap-1.5"><Label htmlFor="rp-notes">Notes</Label><Textarea id="rp-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
      </div>
    </ActionDialog>
  );
}

function CancelDialog({ busy, run }: { busy: string | null; run: ReturnType<typeof useAction>["run"] }) {
  const [reason, setReason] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  return (
    <ActionDialog
      trigger={<Button variant="outline" className="text-destructive hover:text-destructive" disabled={!!busy}>Cancel booking</Button>}
      title="Cancel this booking?"
      description="The dates become available again immediately. Refunds (if any) are handled separately."
      confirmLabel="Cancel booking"
      destructive
      busy={busy === "Cancel"}
      onConfirm={(close) => run("Cancel", { action: "CANCEL", reason, sendEmail }, close)}
    >
      <div className="grid gap-4 py-2">
        <div className="grid gap-1.5"><Label htmlFor="cx-reason">Reason (shared with guest if emailed)</Label><Textarea id="cx-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} /> Email the guest</label>
      </div>
    </ActionDialog>
  );
}
