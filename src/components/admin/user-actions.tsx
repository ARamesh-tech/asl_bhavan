"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

export function UserActions({ id, role, isActive, isSelf }: { id: string; role: "USER" | "ADMIN"; isActive: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function patch(body: { role?: "USER" | "ADMIN"; isActive?: boolean }, label: string) {
    if (!confirm(`${label}?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "PATCH", json: body });
      toast.success("User updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update user");
    } finally {
      setBusy(false);
    }
  }
  if (isSelf) return <span className="text-xs text-muted-foreground">You</span>;
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {role === "USER" ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => patch({ role: "ADMIN" }, "Grant admin access")}>Make admin</Button>
      ) : (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => patch({ role: "USER" }, "Remove admin access")}>Remove admin</Button>
      )}
      {isActive ? (
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => patch({ isActive: false }, "Deactivate this account (signs them out)")}>Deactivate</Button>
      ) : (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => patch({ isActive: true }, "Reactivate this account")}>Reactivate</Button>
      )}
    </div>
  );
}
