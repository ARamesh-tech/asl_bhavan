"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { apiFetch } from "@/lib/api/client";

type Props = {
  url: string;
  method?: "POST" | "PATCH" | "DELETE";
  json?: unknown;
  children: ReactNode;
  successMessage?: string;
  /** When set, shows a confirmation dialog before sending. */
  confirm?: { title: string; description?: string; actionLabel?: string; destructive?: boolean };
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
  disabled?: boolean;
  onDone?: (data: unknown) => void;
};

/** Small client button that POSTs to an admin API and refreshes the server page. */
export function ActionButton({ url, method = "POST", json, children, successMessage = "Done", confirm, variant = "outline", size = "sm", className, disabled, onDone }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const data = await apiFetch<unknown>(url, { method, json });
      toast.success(successMessage);
      onDone?.(data);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const button = (
    <Button variant={variant} size={size} className={className} disabled={busy || disabled} onClick={confirm ? undefined : () => void run()}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );

  if (!confirm) return button;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{button}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
          {confirm.description && <AlertDialogDescription>{confirm.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); void run(); }}
            disabled={busy}
            className={confirm.destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
          >
            {busy && <Loader2 className="animate-spin" aria-hidden />} {confirm.actionLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
