"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";

export function InternalNotes({ bookingId, initial }: { bookingId: string; initial: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = value !== (initial ?? "");

  async function save() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/bookings/${bookingId}`, { method: "PATCH", json: { internalNotes: value.trim() || null } });
      toast.success("Notes saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save notes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea rows={4} value={value} onChange={(e) => setValue(e.target.value)} maxLength={2000} placeholder="Private notes for staff — never shown to the guest." aria-label="Internal notes" />
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || busy}>{busy && <Loader2 className="animate-spin" aria-hidden />} Save notes</Button>
      </div>
    </div>
  );
}
