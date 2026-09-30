"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";

export function CancelBookingButton({ reference, emailHint, policyText }: { reference: string; emailHint?: string | null; policyText: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await apiFetch(`/api/bookings/${encodeURIComponent(reference)}/cancel`, { method: "POST", json: { reason: reason || undefined, email: emailHint || undefined } });
      toast.success("Booking cancelled");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel this booking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive">Cancel booking</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel booking {reference}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{policyText}</p>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-foreground">Reason (optional)</span>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              </label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep booking</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirm(); }} disabled={busy} className="bg-destructive text-white hover:bg-destructive/90">
            {busy && <Loader2 className="animate-spin" aria-hidden />} Cancel booking
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
