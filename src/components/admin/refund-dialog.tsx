"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { formatMoney } from "@/lib/money";

export function RefundDialog({ paymentId, remaining, currency }: { paymentId: string; remaining: number; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/payments/${paymentId}/refund`, { method: "POST", json: { amount: Number(amount), notes: notes || undefined } });
      toast.success("Refund initiated with Razorpay");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refund failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Undo2 aria-hidden /> Refund</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund online payment</DialogTitle>
          <DialogDescription>Up to {formatMoney(remaining, currency)} can be refunded. Razorpay usually settles refunds to the guest within 5–7 working days.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`refund-amount-${paymentId}`}>Amount ({currency})</Label>
            <Input id={`refund-amount-${paymentId}`} type="number" inputMode="decimal" min={1} step="0.01" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`refund-notes-${paymentId}`}>Reason (optional)</Label>
            <Textarea id={`refund-notes-${paymentId}`} rows={2} maxLength={250} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || Number(amount) <= 0 || Number(amount) > remaining + 0.005}>
            {busy && <Loader2 className="animate-spin" aria-hidden />} Refund {formatMoney(Number(amount) || 0, currency)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
