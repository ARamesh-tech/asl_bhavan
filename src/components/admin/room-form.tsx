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
import { roomUpsertSchema } from "@/lib/validation/admin";

type FormValues = z.input<typeof roomUpsertSchema>;
export type AmenityOption = { id: string; name: string; category: string | null };

const selectCls = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function RoomForm({ roomId, initial, amenities, currency }: { roomId?: string; initial?: Partial<FormValues>; amenities: AmenityOption[]; currency: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, setValue, watch, formState: { errors, isSubmitting, dirtyFields } } = useForm<FormValues>({
    resolver: zodResolver(roomUpsertSchema, undefined, { raw: true }),
    defaultValues: {
      name: "", slug: "", roomNumber: "", type: "PRIVATE_ROOM", category: "", shortDescription: "", description: "",
      capacity: 2, minGuests: 1, maxGuests: 2, basePrice: 0, pricePerPerson: "", weekendPrice: "", bedConfiguration: "", sizeSqFt: "", floor: "", rules: "",
      status: "ACTIVE", isActive: true, isFeatured: false, sortOrder: 0, amenityIds: [],
      ...initial,
    },
  });
  const type = watch("type");
  const selectedAmenities = watch("amenityIds") ?? [];

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = roomId
        ? await apiFetch<{ id: string }>(`/api/admin/rooms/${roomId}`, { method: "PUT", json: values })
        : await apiFetch<{ id: string }>("/api/admin/rooms", { method: "POST", json: values });
      toast.success(roomId ? "Room saved" : "Room created");
      if (!roomId) router.push(`/admin/rooms/${res.id}`);
      router.refresh();
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err instanceof Error ? err.message : "Could not save the room.");
    }
  });

  const toggleAmenity = (id: string) => {
    const next = selectedAmenities.includes(id) ? selectedAmenities.filter((a) => a !== id) : [...selectedAmenities, id];
    setValue("amenityIds", next, { shouldDirty: true });
  };
  const groups = amenities.reduce<Record<string, AmenityOption[]>>((acc, a) => { (acc[a.category ?? "Other"] ??= []).push(a); return acc; }, {});

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-semibold">Basics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="rm-name" label="Name" required error={errors.name?.message}>
              <Input className="h-11" {...fieldA11y("rm-name", errors.name?.message)} {...register("name", { onChange: (e) => { if (!roomId && !dirtyFields.slug) setValue("slug", slugify(e.target.value)); } })} />
            </Field>
            <Field id="rm-slug" label="URL slug" required error={errors.slug?.message} description="Used in the public URL, e.g. /rooms/deluxe-room-1">
              <Input className="h-11 font-mono text-sm" {...fieldA11y("rm-slug", errors.slug?.message)} {...register("slug")} />
            </Field>
            <Field id="rm-type" label="Type" required error={errors.type?.message}>
              <select id="rm-type" className={selectCls} {...register("type")}><option value="PRIVATE_ROOM">Private room</option><option value="DORMITORY">Dormitory (shared beds)</option></select>
            </Field>
            <Field id="rm-category" label="Category" required error={errors.category?.message} description="Shown on cards, e.g. Deluxe AC Room">
              <Input className="h-11" {...fieldA11y("rm-category", errors.category?.message)} {...register("category")} />
            </Field>
            <Field id="rm-number" label="Room number" error={errors.roomNumber?.message}><Input className="h-11" {...fieldA11y("rm-number", errors.roomNumber?.message)} {...register("roomNumber")} /></Field>
            <Field id="rm-floor" label="Floor" error={errors.floor?.message}><Input className="h-11" {...fieldA11y("rm-floor", errors.floor?.message)} {...register("floor")} /></Field>
          </div>
          <Field id="rm-short" label="Short description" error={errors.shortDescription?.message} description="One line for cards (max 200 chars)."><Input className="h-11" {...fieldA11y("rm-short", errors.shortDescription?.message)} {...register("shortDescription")} /></Field>
          <Field id="rm-desc" label="Full description" required error={errors.description?.message}><Textarea rows={6} {...fieldA11y("rm-desc", errors.description?.message)} {...register("description")} /></Field>
          <Field id="rm-rules" label="Room rules" error={errors.rules?.message}><Textarea rows={3} {...fieldA11y("rm-rules", errors.rules?.message)} {...register("rules")} /></Field>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-semibold">Capacity & pricing</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="rm-cap" label={type === "DORMITORY" ? "Total beds" : "Capacity"} required error={errors.capacity?.message}><Input type="number" min={1} className="h-11" {...fieldA11y("rm-cap", errors.capacity?.message)} {...register("capacity")} /></Field>
            <Field id="rm-min" label="Min guests" required error={errors.minGuests?.message}><Input type="number" min={1} className="h-11" {...fieldA11y("rm-min", errors.minGuests?.message)} {...register("minGuests")} /></Field>
            <Field id="rm-max" label="Max guests" required error={errors.maxGuests?.message}><Input type="number" min={1} className="h-11" {...fieldA11y("rm-max", errors.maxGuests?.message)} {...register("maxGuests")} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="rm-base" label={type === "DORMITORY" ? `Price per bed / night (${currency})` : `Price per night (${currency})`} required error={errors.basePrice?.message}><Input type="number" min={0} step="0.01" className="h-11" {...fieldA11y("rm-base", errors.basePrice?.message)} {...register("basePrice")} /></Field>
            {type === "DORMITORY" && (
              <Field id="rm-ppp" label={`Per-person price (${currency})`} error={errors.pricePerPerson?.message} description="Defaults to the bed price."><Input type="number" min={0} step="0.01" className="h-11" {...fieldA11y("rm-ppp", errors.pricePerPerson?.message)} {...register("pricePerPerson")} /></Field>
            )}
            <Field id="rm-weekend" label={`Weekend price (${currency})`} error={errors.weekendPrice?.message} description="Blank = same as base. Weekend nights are set in Settings."><Input type="number" min={0} step="0.01" className="h-11" {...fieldA11y("rm-weekend", errors.weekendPrice?.message)} {...register("weekendPrice")} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="rm-beds" label="Bed configuration" error={errors.bedConfiguration?.message} description="e.g. 1 double bed · 6 single bunk beds"><Input className="h-11" {...fieldA11y("rm-beds", errors.bedConfiguration?.message)} {...register("bedConfiguration")} /></Field>
            <Field id="rm-size" label="Size (sq ft)" error={errors.sizeSqFt?.message}><Input type="number" min={1} className="h-11" {...fieldA11y("rm-size", errors.sizeSqFt?.message)} {...register("sizeSqFt")} /></Field>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-semibold">Amenities</h2>
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{group}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((a) => {
                  const on = selectedAmenities.includes(a.id);
                  return (
                    <button key={a.id} type="button" aria-pressed={on} onClick={() => toggleAmenity(a.id)} className={`rounded-full border px-3 py-1 text-sm transition-colors ${on ? "border-brand bg-brand text-white" : "hover:bg-muted"}`}>{a.name}</button>
                  );
                })}
              </div>
            </div>
          ))}
          {amenities.length === 0 && <p className="text-sm text-muted-foreground">No amenities defined yet — run the seed or add them in Settings.</p>}
        </section>
      </div>

      <aside className="space-y-6">
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-semibold">Visibility</h2>
          <Field id="rm-status" label="Operational status" error={errors.status?.message}>
            <select id="rm-status" className={selectCls} {...register("status")}><option value="ACTIVE">Active</option><option value="MAINTENANCE">Under maintenance (not bookable)</option><option value="INACTIVE">Inactive (not bookable)</option></select>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" {...register("isActive")} /> Show on website</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" {...register("isFeatured")} /> Feature on homepage</label>
          <Field id="rm-sort" label="Sort order" error={errors.sortOrder?.message} description="Lower numbers appear first."><Input type="number" min={0} className="h-11" {...fieldA11y("rm-sort", errors.sortOrder?.message)} {...register("sortOrder")} /></Field>
        </section>
        {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
        <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" aria-hidden />} {roomId ? "Save room" : "Create room"}</Button>
      </aside>
    </form>
  );
}
