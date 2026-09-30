"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { applyServerErrors } from "@/components/forms/auth-forms";
import { Field, fieldA11y } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import type { BookingDto } from "@/lib/booking/serialize";
import { PAYMENT_STATUS_LABELS } from "@/lib/booking/status";
import { BOOKING_SOURCE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { MANUAL_PAYMENT_STATUS_OPTIONS, manualBookingSchema, PAYMENT_METHODS } from "@/lib/validation/admin";

type FormValues = z.input<typeof manualBookingSchema>;
export type RoomOption = { id: string; name: string; type: "PRIVATE_ROOM" | "DORMITORY"; capacity: number; minGuests: number; maxGuests: number };

const selectCls = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";

export function ManualBookingForm({ rooms, currency }: { rooms: RoomOption[]; currency: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(manualBookingSchema, undefined, { raw: true }),
    defaultValues: {
      roomId: rooms[0]?.id ?? "",
      checkIn: "",
      checkOut: "",
      guestCount: 1,
      name: "",
      email: "",
      phone: "",
      source: "PHONE",
      status: "CONFIRMED",
      paymentStatus: "PENDING",
      paymentMethod: "CASH",
      amountReceived: 0,
      discount: 0,
      additionalCharges: 0,
      transactionId: "",
      specialRequests: "",
      internalNotes: "",
      allowPastDates: false,
      sendEmail: false,
    },
  });
  const { register, handleSubmit, setError, watch, formState: { errors, isSubmitting } } = form;
  const roomId = watch("roomId");
  const room = rooms.find((r) => r.id === roomId);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { booking } = await apiFetch<{ booking: BookingDto }>("/api/admin/bookings", { method: "POST", json: values });
      toast.success(`Booking ${booking.bookingReference} created`);
      router.push(`/admin/bookings/${booking.id}`);
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err instanceof Error ? err.message : "Could not create the booking.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-semibold">Stay</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="mb-room" label="Room" required error={errors.roomId?.message}>
              <select id="mb-room" className={selectCls} {...register("roomId")}>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}{r.type === "DORMITORY" ? ` (dormitory, ${r.capacity} beds)` : ""}</option>)}
              </select>
            </Field>
            <Field id="mb-guests" label={room?.type === "DORMITORY" ? "Beds / guests" : "Guests"} required error={errors.guestCount?.message} description={room ? `${room.minGuests}–${room.maxGuests} for this unit` : undefined}>
              <Input type="number" min={1} max={50} className="h-11" {...fieldA11y("mb-guests", errors.guestCount?.message)} {...register("guestCount")} />
            </Field>
            <Field id="mb-in" label="Check-in" required error={errors.checkIn?.message}>
              <Input type="date" className="h-11" {...fieldA11y("mb-in", errors.checkIn?.message)} {...register("checkIn")} />
            </Field>
            <Field id="mb-out" label="Check-out" required error={errors.checkOut?.message}>
              <Input type="date" className="h-11" {...fieldA11y("mb-out", errors.checkOut?.message)} {...register("checkOut")} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" {...register("allowPastDates")} /> Allow a check-in date in the past (recording an ongoing or earlier stay)</label>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-semibold">Guest</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="mb-name" label="Full name" required error={errors.name?.message}><Input className="h-11" {...fieldA11y("mb-name", errors.name?.message)} {...register("name")} /></Field>
            <Field id="mb-phone" label="Phone" required error={errors.phone?.message}><Input type="tel" className="h-11" {...fieldA11y("mb-phone", errors.phone?.message)} {...register("phone")} /></Field>
          </div>
          <Field id="mb-email" label="Email" required error={errors.email?.message} description="Required for confirmations and receipts. Use your own address if the guest has none."><Input type="email" className="h-11" {...fieldA11y("mb-email", errors.email?.message)} {...register("email")} /></Field>
          <Field id="mb-req" label="Special requests" error={errors.specialRequests?.message}><Textarea id="mb-req" rows={2} {...register("specialRequests")} /></Field>
          <Field id="mb-notes" label="Internal notes" error={errors.internalNotes?.message}><Textarea id="mb-notes" rows={2} {...register("internalNotes")} /></Field>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-semibold">Status & payment</h2>
          <Field id="mb-source" label="Source" error={errors.source?.message}>
            <select id="mb-source" className={selectCls} {...register("source")}>
              {(["PHONE", "WALK_IN", "WHATSAPP", "MANUAL"] as const).map((s) => <option key={s} value={s}>{BOOKING_SOURCE_LABELS[s]}</option>)}
            </select>
          </Field>
          <Field id="mb-status" label="Booking status" error={errors.status?.message}>
            <select id="mb-status" className={selectCls} {...register("status")}>
              <option value="CONFIRMED">Confirmed</option>
              <option value="OWNER_CONFIRMATION">Awaiting confirmation (hold)</option>
              <option value="CHECKED_IN">Checked in (guest is here)</option>
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="mb-disc" label={`Discount (${currency})`} error={errors.discount?.message}><Input id="mb-disc" type="number" min={0} step="0.01" className="h-11" {...register("discount")} /></Field>
            <Field id="mb-extra" label={`Extra charges (${currency})`} error={errors.additionalCharges?.message}><Input id="mb-extra" type="number" min={0} step="0.01" className="h-11" {...register("additionalCharges")} /></Field>
          </div>
          <Field id="mb-pstatus" label="Payment status" error={errors.paymentStatus?.message}>
            <select id="mb-pstatus" className={selectCls} {...register("paymentStatus")}>
              {MANUAL_PAYMENT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="mb-method" label="Method" error={errors.paymentMethod?.message}>
              <select id="mb-method" className={selectCls} {...register("paymentMethod")}>
                {PAYMENT_METHODS.filter((m) => m !== "RAZORPAY").map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
              </select>
            </Field>
            <Field id="mb-amt" label={`Received (${currency})`} error={errors.amountReceived?.message}><Input id="mb-amt" type="number" min={0} step="0.01" className="h-11" {...register("amountReceived")} /></Field>
          </div>
          <Field id="mb-txn" label="Transaction reference" error={errors.transactionId?.message}><Input id="mb-txn" className="h-11" {...register("transactionId")} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" {...register("sendEmail")} /> Email confirmation to guest</label>
        </section>
        <p className="text-xs text-muted-foreground">The total is calculated from the room&apos;s current prices and any overrides for these dates; availability is enforced exactly as for online bookings.</p>
        {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
        <Button type="submit" size="xl" className="w-full" disabled={isSubmitting || rooms.length === 0}>{isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Create booking</Button>
      </aside>
    </form>
  );
}
