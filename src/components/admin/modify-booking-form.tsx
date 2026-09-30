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
import { modifyBookingSchema } from "@/lib/validation/admin";
import type { RoomOption } from "./manual-booking-form";

type FormValues = z.input<typeof modifyBookingSchema>;
const selectCls = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";

export function ModifyBookingForm({ booking, rooms, currency }: { booking: BookingDto; rooms: RoomOption[]; currency: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(modifyBookingSchema, undefined, { raw: true }),
    defaultValues: {
      roomId: booking.room.id,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guestCount: booking.guestCount,
      discount: booking.discount,
      additionalCharges: booking.additionalCharges,
      specialRequests: booking.specialRequests ?? "",
      name: booking.guestName,
      email: booking.guestEmail,
      phone: booking.guestPhone,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiFetch(`/api/admin/bookings/${booking.id}`, { method: "PATCH", json: values });
      toast.success("Booking updated and re-priced");
      router.push(`/admin/bookings/${booking.id}`);
      router.refresh();
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err instanceof Error ? err.message : "Could not update the booking.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="font-semibold">Stay</h2>
        <Field id="ed-room" label="Room" error={errors.roomId?.message}>
          <select id="ed-room" className={selectCls} {...register("roomId")}>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="ed-in" label="Check-in" error={errors.checkIn?.message}><Input type="date" className="h-11" {...fieldA11y("ed-in", errors.checkIn?.message)} {...register("checkIn")} /></Field>
          <Field id="ed-out" label="Check-out" error={errors.checkOut?.message}><Input type="date" className="h-11" {...fieldA11y("ed-out", errors.checkOut?.message)} {...register("checkOut")} /></Field>
          <Field id="ed-guests" label="Guests" error={errors.guestCount?.message}><Input type="number" min={1} className="h-11" {...fieldA11y("ed-guests", errors.guestCount?.message)} {...register("guestCount")} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ed-disc" label={`Discount (${currency})`} error={errors.discount?.message}><Input id="ed-disc" type="number" min={0} step="0.01" className="h-11" {...register("discount")} /></Field>
          <Field id="ed-extra" label={`Extra charges (${currency})`} error={errors.additionalCharges?.message}><Input id="ed-extra" type="number" min={0} step="0.01" className="h-11" {...register("additionalCharges")} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Changing room, dates or guests re-checks availability (excluding this booking) and recalculates the total from current prices. Payments already recorded are kept.</p>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="font-semibold">Primary guest</h2>
        <Field id="ed-name" label="Full name" error={errors.name?.message}><Input className="h-11" {...fieldA11y("ed-name", errors.name?.message)} {...register("name")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ed-phone" label="Phone" error={errors.phone?.message}><Input type="tel" className="h-11" {...fieldA11y("ed-phone", errors.phone?.message)} {...register("phone")} /></Field>
          <Field id="ed-email" label="Email" error={errors.email?.message}><Input type="email" className="h-11" {...fieldA11y("ed-email", errors.email?.message)} {...register("email")} /></Field>
        </div>
        <Field id="ed-req" label="Special requests" error={errors.specialRequests?.message}><Textarea id="ed-req" rows={3} {...register("specialRequests")} /></Field>
        {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Save changes</Button>
          <Button type="button" size="lg" variant="outline" onClick={() => router.back()}>Back</Button>
        </div>
      </section>
    </form>
  );
}
