"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm, type FieldValues, type Path, type UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { Field, fieldA11y } from "./field";

/** Push server-side field errors into react-hook-form; returns true if any were applied. */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>): boolean {
  if (!(err instanceof ApiClientError)) return false;
  const fields = err.fieldErrors;
  const keys = Object.keys(fields);
  if (keys.length === 0) return false;
  for (const k of keys) setError(k as Path<T>, { type: "server", message: fields[k] });
  return true;
}

function safeNext(next: string | null): string {
  // Only allow same-origin relative paths to avoid open redirects.
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/my-bookings";
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { user } = await apiFetch<{ user: { role: string } }>("/api/auth/login", { method: "POST", json: values });
      toast.success("Welcome back!");
      const next = params.get("next");
      router.push(next ? safeNext(next) : user.role === "ADMIN" ? "/admin" : "/my-bookings");
      router.refresh();
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err instanceof Error ? err.message : "Could not sign in.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {params.get("registered") && <p className="rounded-lg bg-status-available-soft px-3 py-2 text-sm text-status-available">Account created. Please sign in.</p>}
      {params.get("reset") && <p className="rounded-lg bg-status-available-soft px-3 py-2 text-sm text-status-available">Password updated. Please sign in with your new password.</p>}
      <Field id="login-email" label="Email" required error={errors.email?.message}>
        <Input type="email" autoComplete="email" inputMode="email" className="h-11" {...fieldA11y("login-email", errors.email?.message)} {...register("email")} />
      </Field>
      <Field id="login-password" label="Password" required error={errors.password?.message}>
        <Input type="password" autoComplete="current-password" className="h-11" {...fieldA11y("login-password", errors.password?.message)} {...register("password")} />
      </Field>
      {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
      <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}{isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <Link href="/forgot-password" className="hover:underline">Forgot password?</Link>
        <span>New here? <Link href={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="font-medium text-brand hover:underline">Create an account</Link></span>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema), defaultValues: { name: "", email: "", phone: "", password: "" } });
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiFetch("/api/auth/register", { method: "POST", json: values });
      toast.success("Account created. Welcome!");
      router.push(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err instanceof Error ? err.message : "Could not create your account.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field id="reg-name" label="Full name" required error={errors.name?.message}>
        <Input autoComplete="name" className="h-11" {...fieldA11y("reg-name", errors.name?.message)} {...register("name")} />
      </Field>
      <Field id="reg-email" label="Email" required error={errors.email?.message}>
        <Input type="email" autoComplete="email" inputMode="email" className="h-11" {...fieldA11y("reg-email", errors.email?.message)} {...register("email")} />
      </Field>
      <Field id="reg-phone" label="Phone (WhatsApp preferred)" required error={errors.phone?.message} description="We use this to coordinate your stay.">
        <Input type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" className="h-11" {...fieldA11y("reg-phone", errors.phone?.message, "We use this to coordinate your stay.")} {...register("phone")} />
      </Field>
      <Field id="reg-password" label="Password" required error={errors.password?.message} description="At least 8 characters with a letter and a number.">
        <Input type="password" autoComplete="new-password" className="h-11" {...fieldA11y("reg-password", errors.password?.message, "At least 8 characters with a letter and a number.")} {...register("password")} />
      </Field>
      {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
      <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}{isSubmitting ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link></p>
      <p className="text-center text-xs text-muted-foreground">By registering you agree to our <Link href="/policies#terms" className="underline">terms</Link> and <Link href="/policies#privacy" className="underline">privacy policy</Link>.</p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [done, setDone] = useState(false);
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch("/api/auth/forgot-password", { method: "POST", json: values });
    } catch {
      // Same UX regardless — avoid account enumeration.
    }
    setDone(true);
  });

  if (done) {
    return <p className="rounded-lg bg-status-available-soft px-4 py-3 text-sm text-status-available">If an account exists for that email, we have sent a reset link. Please check your inbox (and spam folder).</p>;
  }
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field id="fp-email" label="Email" required error={errors.email?.message}>
        <Input type="email" autoComplete="email" className="h-11" {...fieldA11y("fp-email", errors.email?.message)} {...register("email")} />
      </Field>
      <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}{isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-muted-foreground"><Link href="/login" className="hover:underline">Back to sign in</Link></p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token, password: "" } });
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiFetch("/api/auth/reset-password", { method: "POST", json: values });
      router.push("/login?reset=1");
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err instanceof Error ? err.message : "Could not reset password.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <input type="hidden" {...register("token")} />
      <Field id="rp-password" label="New password" required error={errors.password?.message} description="At least 8 characters with a letter and a number.">
        <Input type="password" autoComplete="new-password" className="h-11" {...fieldA11y("rp-password", errors.password?.message, "At least 8 characters with a letter and a number.")} {...register("password")} />
      </Field>
      {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
      <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}{isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
