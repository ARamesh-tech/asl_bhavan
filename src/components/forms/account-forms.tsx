"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { changePasswordSchema, updateProfileSchema } from "@/lib/validation/auth";
import { applyServerErrors } from "./auth-forms";
import { Field, fieldA11y } from "./field";

export function ProfileForm({ defaults }: { defaults: { name: string; phone: string; email: string } }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.input<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema, undefined, { raw: true }),
    defaultValues: { name: defaults.name, phone: defaults.phone },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiFetch("/api/account/profile", { method: "PATCH", json: values });
      toast.success("Profile updated");
      router.refresh();
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err instanceof Error ? err.message : "Could not update your profile.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field id="pf-email" label="Email" description="Email cannot be changed here. Contact the owner if you need to update it.">
        <Input value={defaults.email} readOnly disabled className="h-11" id="pf-email" />
      </Field>
      <Field id="pf-name" label="Full name" required error={errors.name?.message}>
        <Input autoComplete="name" className="h-11" {...fieldA11y("pf-name", errors.name?.message)} {...register("name")} />
      </Field>
      <Field id="pf-phone" label="Phone" required error={errors.phone?.message}>
        <Input type="tel" autoComplete="tel" inputMode="tel" className="h-11" {...fieldA11y("pf-phone", errors.phone?.message)} {...register("phone")} />
      </Field>
      {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
      <Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Save changes</Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema, undefined, { raw: true }),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiFetch("/api/account/password", { method: "POST", json: values });
      toast.success("Password changed");
      reset();
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err instanceof Error ? err.message : "Could not change your password.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field id="cp-current" label="Current password" required error={errors.currentPassword?.message}>
        <Input type="password" autoComplete="current-password" className="h-11" {...fieldA11y("cp-current", errors.currentPassword?.message)} {...register("currentPassword")} />
      </Field>
      <Field id="cp-new" label="New password" required error={errors.newPassword?.message} description="At least 8 characters with a letter and a number.">
        <Input type="password" autoComplete="new-password" className="h-11" {...fieldA11y("cp-new", errors.newPassword?.message)} {...register("newPassword")} />
      </Field>
      {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
      <Button type="submit" size="lg" variant="outline" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Change password</Button>
    </form>
  );
}
