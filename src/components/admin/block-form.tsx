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
import { apiFetch } from "@/lib/api/client";
import { ROOM_BLOCK_TYPE_LABELS } from "@/lib/labels";
import { roomBlockSchema } from "@/lib/validation/admin";
import type { RoomOption } from "./manual-booking-form";

type FormValues = z.input<typeof roomBlockSchema>;
const selectCls = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";

export function BlockForm({ rooms, defaultRoomId }: { rooms: RoomOption[]; defaultRoomId?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, reset, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(roomBlockSchema, undefined, { raw: true }),
    defaultValues: { roomId: defaultRoomId ?? rooms[0]?.id ?? "", startDate: "", endDate: "", type: "MAINTENANCE", reason: "", bedsBlocked: "" },
  });
  const room = rooms.find((r) => r.id === watch("roomId"));

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiFetch("/api/admin/blocks", { method: "POST", json: values });
      toast.success("Dates blocked");
      reset({ ...values, startDate: "", endDate: "", reason: "" });
      router.refresh();
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err instanceof Error ? err.message : "Could not create the block.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <Field id="bl-room" label="Unit" required error={errors.roomId?.message}>
        <select id="bl-room" className={selectCls} {...register("roomId")}>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      </Field>
      <Field id="bl-type" label="Type" required error={errors.type?.message}>
        <select id="bl-type" className={selectCls} {...register("type")}>
          {(Object.keys(ROOM_BLOCK_TYPE_LABELS) as Array<keyof typeof ROOM_BLOCK_TYPE_LABELS>).map((t) => <option key={t} value={t}>{ROOM_BLOCK_TYPE_LABELS[t]}</option>)}
        </select>
      </Field>
      <Field id="bl-start" label="From (night of)" required error={errors.startDate?.message}><Input type="date" className="h-11" {...fieldA11y("bl-start", errors.startDate?.message)} {...register("startDate")} /></Field>
      <Field id="bl-end" label="Until (exclusive)" required error={errors.endDate?.message}><Input type="date" className="h-11" {...fieldA11y("bl-end", errors.endDate?.message)} {...register("endDate")} /></Field>
      {room?.type === "DORMITORY" ? (
        <Field id="bl-beds" label="Beds to block" description={`Blank = all ${room.capacity}`} error={errors.bedsBlocked?.message}><Input type="number" min={1} max={room.capacity} className="h-11" {...fieldA11y("bl-beds", errors.bedsBlocked?.message)} {...register("bedsBlocked")} /></Field>
      ) : (
        <Field id="bl-reason" label="Reason" error={errors.reason?.message}><Input className="h-11" {...fieldA11y("bl-reason", errors.reason?.message)} {...register("reason")} /></Field>
      )}
      <div className="flex items-end">
        <Button type="submit" size="lg" className="h-11 w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Block dates</Button>
      </div>
      {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2 lg:col-span-6">{formError}</p>}
    </form>
  );
}
