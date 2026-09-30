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
import { roomPriceSchema } from "@/lib/validation/admin";

type FormValues = z.input<typeof roomPriceSchema>;

export function PriceOverrideForm({ roomId, isDormitory, currency }: { roomId: string; isDormitory: boolean; currency: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(roomPriceSchema, undefined, { raw: true }),
    defaultValues: { roomId, startDate: "", endDate: "", price: "" as unknown as number, pricePerPerson: "", priority: 10, reason: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiFetch("/api/admin/prices", { method: "POST", json: values });
      toast.success("Special rate saved");
      reset({ roomId, startDate: "", endDate: "", price: "" as unknown as number, pricePerPerson: "", priority: 10, reason: "" });
      router.refresh();
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err instanceof Error ? err.message : "Could not save the rate.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <input type="hidden" {...register("roomId")} />
      <Field id="po-start" label="From (night of)" required error={errors.startDate?.message}><Input type="date" className="h-11" {...fieldA11y("po-start", errors.startDate?.message)} {...register("startDate")} /></Field>
      <Field id="po-end" label="Until (exclusive)" required error={errors.endDate?.message}><Input type="date" className="h-11" {...fieldA11y("po-end", errors.endDate?.message)} {...register("endDate")} /></Field>
      <Field id="po-price" label={isDormitory ? `Per bed (${currency})` : `Per night (${currency})`} required error={errors.price?.message}><Input type="number" min={1} step="0.01" className="h-11" {...fieldA11y("po-price", errors.price?.message)} {...register("price")} /></Field>
      <Field id="po-priority" label="Priority" error={errors.priority?.message} description="Higher wins if ranges overlap."><Input type="number" min={0} max={100} className="h-11" {...fieldA11y("po-priority", errors.priority?.message)} {...register("priority")} /></Field>
      <Field id="po-reason" label="Label" error={errors.reason?.message} description="e.g. Diwali, Peak season"><Input className="h-11" {...fieldA11y("po-reason", errors.reason?.message)} {...register("reason")} /></Field>
      <div className="flex items-end"><Button type="submit" className="h-11 w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Add rate</Button></div>
      {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2 lg:col-span-6">{formError}</p>}
    </form>
  );
}
