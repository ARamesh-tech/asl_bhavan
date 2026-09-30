"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";

export function MessageActions({ id, status, notes }: { id: string; status: "NEW" | "READ" | "RESOLVED"; notes: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(notes ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  async function update(next: "NEW" | "READ" | "RESOLVED") {
    setBusy(next);
    try {
      await apiFetch(`/api/admin/messages/${id}`, { method: "PATCH", json: { status: next, adminNotes: value } });
      toast.success("Message updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea rows={2} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Private notes (what you replied, follow-ups…)" aria-label="Admin notes" maxLength={2000} />
      <div className="flex flex-wrap gap-2">
        {status !== "READ" && status !== "RESOLVED" && <Button size="sm" variant="outline" onClick={() => update("READ")} disabled={!!busy}>{busy === "READ" && <Loader2 className="animate-spin" aria-hidden />} Mark read</Button>}
        {status !== "RESOLVED" && <Button size="sm" onClick={() => update("RESOLVED")} disabled={!!busy}>{busy === "RESOLVED" && <Loader2 className="animate-spin" aria-hidden />} Resolve</Button>}
        {status === "RESOLVED" && <Button size="sm" variant="outline" onClick={() => update("READ")} disabled={!!busy}>Reopen</Button>}
        {value !== (notes ?? "") && <Button size="sm" variant="ghost" onClick={() => update(status)} disabled={!!busy}>Save notes</Button>}
      </div>
    </div>
  );
}
