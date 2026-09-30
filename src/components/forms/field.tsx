"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/**
 * Accessible field wrapper: associates label, description and error with the control via
 * ids, and exposes `aria-invalid` / `aria-describedby` props to spread onto the input.
 */
export function Field({
  id,
  label,
  error,
  description,
  required,
  children,
  className = "",
}: {
  id: string;
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive" aria-hidden> *</span>}
      </Label>
      {children}
      {description && !error && <p id={`${id}-desc`} className="text-xs text-muted-foreground">{description}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

export function fieldA11y(id: string, error?: string, description?: string) {
  const describedBy = [error ? `${id}-error` : null, !error && description ? `${id}-desc` : null].filter(Boolean).join(" ") || undefined;
  return { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy };
}
