"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

type Order = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  bookingReference: string;
  prefill: { name: string; email: string; contact: string };
  description: string;
};

type RazorpaySuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void; escape?: boolean; confirm_close?: boolean };
  retry?: { enabled: boolean };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", cb: (resp: { error: { description?: string; reason?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay"));
    document.body.appendChild(s);
  });
}

export function RazorpayCheckout(props: {
  reference: string;
  emailHint: string | null;
  propertyName: string;
  amountLabel: string;
  holdExpiresAt: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "ordering" | "checkout" | "verifying" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    if (!props.holdExpiresAt) return;
    const end = new Date(props.holdExpiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [props.holdExpiresAt]);

  useEffect(() => {
    if (remaining === 0) router.refresh();
  }, [remaining, router]);

  const successUrl = `/booking/${encodeURIComponent(props.reference)}${props.emailHint ? `?e=${encodeURIComponent(props.emailHint)}` : ""}`;

  const start = useCallback(async () => {
    setError(null);
    setPhase("ordering");
    try {
      const [order] = await Promise.all([
        apiFetch<Order>("/api/payments/create-order", { method: "POST", json: { reference: props.reference, email: props.emailHint ?? undefined } }),
        loadScript(),
      ]);
      if (!window.Razorpay) throw new Error("Razorpay is unavailable in this browser.");

      setPhase("checkout");
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: props.propertyName,
        description: order.description,
        order_id: order.orderId,
        prefill: order.prefill,
        notes: { bookingReference: order.bookingReference },
        theme: { color: "#8b3a2f" },
        retry: { enabled: true },
        modal: {
          escape: true,
          ondismiss: () => {
            setPhase((p) => (p === "checkout" ? "idle" : p));
          },
        },
        handler: async (resp) => {
          setPhase("verifying");
          try {
            const result = await apiFetch<{ outcome: string }>("/api/payments/verify", {
              method: "POST",
              json: { ...resp, email: props.emailHint ?? undefined },
            });
            setPhase("done");
            if (result.outcome === "NEEDS_ATTENTION") {
              toast.warning("Payment received, but the room was released in the meantime. The owner will contact you about a refund or alternative.");
            } else {
              toast.success("Payment successful — your booking is confirmed.");
            }
            router.replace(successUrl);
            router.refresh();
          } catch (err) {
            setPhase("idle");
            const message = err instanceof ApiClientError ? err.message : "We could not verify the payment. If money was deducted it will be reconciled automatically within a few minutes.";
            setError(message);
          }
        },
      });
      rzp.on("payment.failed", (resp) => {
        setError(resp.error?.description ?? resp.error?.reason ?? "Payment failed. You can try again.");
        setPhase("idle");
      });
      openedRef.current = true;
      rzp.open();
    } catch (err) {
      setPhase("idle");
      setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Could not start payment.");
      if (err instanceof ApiClientError && err.status === 409) router.refresh();
    }
  }, [props.reference, props.emailHint, props.propertyName, router, successUrl]);

  const busy = phase === "ordering" || phase === "verifying" || phase === "done";
  const mm = remaining != null ? String(Math.floor(remaining / 60)).padStart(2, "0") : null;
  const ss = remaining != null ? String(remaining % 60).padStart(2, "0") : null;

  return (
    <div className="space-y-4">
      {remaining != null && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {remaining > 0 ? (
            <>Room held for <span className="font-mono font-semibold text-foreground">{mm}:{ss}</span></>
          ) : (
            <>The payment window has closed. Refreshing…</>
          )}
        </p>
      )}
      <Button size="lg" className="w-full sm:w-auto" onClick={start} disabled={busy || remaining === 0}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <CreditCard aria-hidden />}
        {phase === "ordering" ? "Preparing secure checkout…" : phase === "verifying" ? "Verifying payment…" : phase === "done" ? "Confirmed" : `Pay ${props.amountLabel}`}
      </Button>
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4" aria-hidden /> Payments are processed securely by Razorpay. Card and UPI details never touch our servers.
      </p>
    </div>
  );
}
