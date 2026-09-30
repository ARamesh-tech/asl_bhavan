"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, Search, Users } from "lucide-react";
import { useId, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays, formatDateOnly, parseDateOnly, todayInTimeZone } from "@/lib/booking/dates";

export type SearchValues = { checkIn: string; checkOut: string; guests: number };

/**
 * Check-in / check-out / guests search. Uses native date inputs (fully accessible and
 * excellent on mobile) with client-side validation mirroring the server rules.
 */
export function SearchWidget({
  initial,
  compact = false,
  maxGuests = 20,
}: {
  initial?: Partial<SearchValues>;
  compact?: boolean;
  maxGuests?: number;
}) {
  const router = useRouter();
  const id = useId();
  const today = useMemo(() => formatDateOnly(todayInTimeZone()), []);
  const tomorrow = useMemo(() => formatDateOnly(addDays(todayInTimeZone(), 1)), []);

  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? today);
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? tomorrow);
  const [guests, setGuests] = useState(initial?.guests ?? 2);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const minCheckOut = useMemo(() => {
    const ci = parseDateOnly(checkIn);
    return ci ? formatDateOnly(addDays(ci, 1)) : tomorrow;
  }, [checkIn, tomorrow]);

  function onCheckInChange(value: string) {
    setCheckIn(value);
    const ci = parseDateOnly(value);
    const co = parseDateOnly(checkOut);
    if (ci && (!co || co <= ci)) setCheckOut(formatDateOnly(addDays(ci, 1)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ci = parseDateOnly(checkIn);
    const co = parseDateOnly(checkOut);
    if (!ci || !co) return setError("Please choose valid dates.");
    if (co <= ci) return setError("Check-out must be after check-in.");
    if (ci < todayInTimeZone()) return setError("Check-in cannot be in the past.");
    if (!Number.isInteger(guests) || guests < 1) return setError("Please select at least one guest.");
    setError(null);
    setSubmitting(true);
    const params = new URLSearchParams({ checkIn, checkOut, guests: String(guests) });
    router.push(`/availability?${params.toString()}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`grid gap-3 rounded-2xl border bg-card p-3 shadow-lift sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end ${compact ? "" : "md:p-4"}`}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-in`} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden /> Check-in
        </Label>
        <Input id={`${id}-in`} type="date" required min={today} value={checkIn} onChange={(e) => onCheckInChange(e.target.value)} className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-out`} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden /> Check-out
        </Label>
        <Input id={`${id}-out`} type="date" required min={minCheckOut} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-guests`} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="size-3.5" aria-hidden /> Guests
        </Label>
        <Input
          id={`${id}-guests`}
          type="number"
          inputMode="numeric"
          min={1}
          max={maxGuests}
          required
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          className="h-11 sm:w-24"
        />
      </div>
      <Button type="submit" size="xl" className="h-11 w-full sm:w-auto" disabled={submitting}>
        <Search aria-hidden />
        {submitting ? "Searching…" : "Search Availability"}
      </Button>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive sm:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}
