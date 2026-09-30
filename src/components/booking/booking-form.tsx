"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, Loader2, MessageCircle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { applyServerErrors } from "@/components/forms/auth-forms";
import { Field, fieldA11y } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import type { BookingDto } from "@/lib/booking/serialize";
import { cn } from "cn";
import { createBookingSchema } from "@/lib/validation/booking";

/**
 * The form works with the schema's *input* shape (strings) and the resolver runs in `raw`
 * mode, so the JSON sent to the API is exactly what the server schema expects to parse
 * (date strings rather than Date objects).
 */
type FormValues = z.input<typeof createBookingSchema>;

export type BookingFormProps = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  /** Which submission modes are currently enabled (from settings + integrations). */
  modes: { online: boolean; whatsapp: boolean };
  defaults?: { name?: string; email?: string; phone?: string };
  isDormitory: boolean;
};

const modeCopy = {
  ONLINE: {
    title: "Pay online now",
    body: "Secure payment via Razorpay (UPI, cards, net banking). Your room is held for a few minutes while you pay and confirmed instantly.",
    icon: CreditCard,
  },
  WHATSAPP: {
    title: "Contact owner & pay directly",
    body: "Send your request to the owner on WhatsApp and pay by UPI, bank transfer or cash. The owner confirms your booking manually.",
    icon: MessageCircle,
  },
} as const;

export function BookingForm(props: BookingFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const defaultMode: FormValues["mode"] = props.modes.online ? "ONLINE" : "WHATSAPP";

  const form = useForm<FormValues>({
    resolver: zodResolver(createBookingSchema, undefined, { raw: true }),
    defaultValues: {
      roomId: props.roomId,
      checkIn: props.checkIn,
      checkOut: props.checkOut,
      guestCount: props.guestCount,
      name: props.defaults?.name ?? "",
      email: props.defaults?.email ?? "",
      phone: props.defaults?.phone ?? "",
      specialRequests: "",
      additionalGuests: [],
      mode: defaultMode,
    },
  });
  const { register, handleSubmit, setError, watch, setValue, control, formState: { errors, isSubmitting } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "additionalGuests" });
  const mode = watch("mode");
  const accepted = watch("acceptPolicies");
  const maxAdditional = Math.max(0, props.guestCount - 1);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { booking } = await apiFetch<{ booking: BookingDto }>("/api/bookings", { method: "POST", json: values });
      const e = encodeURIComponent(booking.guestEmail);
      if (values.mode === "ONLINE") {
        router.push(`/booking/${booking.bookingReference}/pay?e=${e}`);
      } else {
        toast.success("Booking request created");
        router.push(`/booking/${booking.bookingReference}?e=${e}&new=1`);
      }
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err instanceof Error ? err.message : "Could not create the booking.");
    }
  });

  const noModes = !props.modes.online && !props.modes.whatsapp;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      <input type="hidden" {...register("roomId")} />
      <input type="hidden" {...register("checkIn")} />
      <input type="hidden" {...register("checkOut")} />
      <input type="hidden" {...register("guestCount")} />

      <section className="space-y-5">
        <h2 className="text-lg font-semibold">Primary guest</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="bk-name" label="Full name" required error={errors.name?.message}>
            <Input autoComplete="name" className="h-11" {...fieldA11y("bk-name", errors.name?.message)} {...register("name")} />
          </Field>
          <Field id="bk-phone" label="Phone (WhatsApp preferred)" required error={errors.phone?.message}>
            <Input type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" className="h-11" {...fieldA11y("bk-phone", errors.phone?.message)} {...register("phone")} />
          </Field>
        </div>
        <Field id="bk-email" label="Email" required error={errors.email?.message} description="Your booking confirmation and receipt are sent here.">
          <Input type="email" autoComplete="email" inputMode="email" className="h-11" {...fieldA11y("bk-email", errors.email?.message, "Your booking confirmation and receipt are sent here.")} {...register("email")} />
        </Field>
      </section>

      {maxAdditional > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Other guests <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
              <p className="text-sm text-muted-foreground">Names of the {maxAdditional} other guest{maxAdditional === 1 ? "" : "s"} help us prepare for check-in.</p>
            </div>
            {fields.length < maxAdditional && (
              <Button type="button" variant="outline" size="sm" onClick={() => append({ fullName: "", age: undefined })}>
                <Plus aria-hidden /> Add guest
              </Button>
            )}
          </div>
          {fields.map((f, i) => (
            <div key={f.id} className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-[1fr_120px_auto] sm:items-end">
              <Field id={`bk-g-${i}-name`} label={`Guest ${i + 2} name`} error={errors.additionalGuests?.[i]?.fullName?.message}>
                <Input className="h-10" {...fieldA11y(`bk-g-${i}-name`, errors.additionalGuests?.[i]?.fullName?.message)} {...register(`additionalGuests.${i}.fullName` as const)} />
              </Field>
              <Field id={`bk-g-${i}-age`} label="Age" error={errors.additionalGuests?.[i]?.age?.message}>
                <Input type="number" min={0} max={120} className="h-10" {...fieldA11y(`bk-g-${i}-age`, errors.additionalGuests?.[i]?.age?.message)} {...register(`additionalGuests.${i}.age` as const)} />
              </Field>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove guest" onClick={() => remove(i)}><Trash2 aria-hidden /></Button>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <Field id="bk-requests" label="Special requests" error={errors.specialRequests?.message} description="Arrival time, dietary needs, extra bedding, etc. The owner will do their best to help.">
          <Textarea rows={3} {...fieldA11y("bk-requests", errors.specialRequests?.message)} {...register("specialRequests")} />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">How would you like to pay?</h2>
        {noModes ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Online booking is temporarily unavailable. Please <Link href="/contact" className="underline">contact the owner</Link> directly.</p>
        ) : (
          <div role="radiogroup" aria-label="Payment method" className="grid gap-3 sm:grid-cols-2">
            {(["ONLINE", "WHATSAPP"] as const).map((m) => {
              const enabled = m === "ONLINE" ? props.modes.online : props.modes.whatsapp;
              if (!enabled) return null;
              const Icon = modeCopy[m].icon;
              const selected = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setValue("mode", m, { shouldValidate: true })}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    selected ? "border-brand bg-brand-soft/40 ring-1 ring-brand" : "hover:bg-muted/40",
                  )}
                >
                  <span className={cn("mt-0.5 rounded-lg p-2", selected ? "bg-brand text-white" : "bg-muted text-muted-foreground")}><Icon className="size-4" aria-hidden /></span>
                  <span>
                    <span className="block font-medium">{modeCopy[m].title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{modeCopy[m].body}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {errors.mode && <p className="text-sm text-destructive">{errors.mode.message}</p>}
      </section>

      <section className="space-y-3">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            id="bk-accept"
            checked={accepted === true}
            onCheckedChange={(v) => setValue("acceptPolicies", (v === true ? true : undefined) as true, { shouldValidate: true })}
            aria-invalid={!!errors.acceptPolicies}
          />
          <span>
            I have read and agree to the <Link href="/policies" target="_blank" className="font-medium text-brand underline">booking policies</Link>, including check-in/check-out times and the cancellation policy.
          </span>
        </label>
        {errors.acceptPolicies && <p className="text-sm text-destructive">{errors.acceptPolicies.message}</p>}
      </section>

      {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}

      <Button type="submit" size="xl" className="w-full" disabled={isSubmitting || noModes}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
        {isSubmitting ? "Reserving…" : mode === "ONLINE" ? "Continue to payment" : "Send booking request"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Availability and price are re-verified on the server when you submit. You will not be charged until payment is complete.</p>
    </form>
  );
}
