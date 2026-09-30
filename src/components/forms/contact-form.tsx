"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { contactMessageSchema } from "@/lib/validation/contact";
import { applyServerErrors } from "./auth-forms";
import { Field, fieldA11y } from "./field";

type Values = z.infer<typeof contactMessageSchema>;

export function ContactForm({ defaults }: { defaults?: Partial<Pick<Values, "name" | "email" | "phone">> }) {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(contactMessageSchema), defaultValues: { name: defaults?.name ?? "", email: defaults?.email ?? "", phone: defaults?.phone ?? "", message: "", website: "" } });
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiFetch("/api/contact", { method: "POST", json: values });
      toast.success("Message sent!");
      setSent(true);
      reset();
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err instanceof Error ? err.message : "Could not send your message.");
    }
  });

  if (sent) {
    return (
      <div className="rounded-2xl bg-status-available-soft p-6 text-center">
        <p className="font-semibold text-status-available">Thank you! Your message has been received.</p>
        <p className="mt-1 text-sm text-muted-foreground">We usually reply within a few hours.</p>
        <Button variant="outline" className="mt-4" onClick={() => setSent(false)}>Send another message</Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="c-name" label="Name" required error={errors.name?.message}>
          <Input autoComplete="name" className="h-11" {...fieldA11y("c-name", errors.name?.message)} {...register("name")} />
        </Field>
        <Field id="c-email" label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" className="h-11" {...fieldA11y("c-email", errors.email?.message)} {...register("email")} />
        </Field>
      </div>
      <Field id="c-phone" label="Phone" error={errors.phone?.message} description="Optional — helps us reach you on WhatsApp.">
        <Input type="tel" autoComplete="tel" className="h-11" {...fieldA11y("c-phone", errors.phone?.message, "Optional — helps us reach you on WhatsApp.")} {...register("phone")} />
      </Field>
      <Field id="c-message" label="Message" required error={errors.message?.message}>
        <Textarea rows={5} {...fieldA11y("c-message", errors.message?.message)} {...register("message")} />
      </Field>
      {/* Honeypot for bots; hidden from users and assistive tech. */}
      <div className="hidden" aria-hidden><label>Website<input type="text" tabIndex={-1} autoComplete="off" {...register("website")} /></label></div>
      {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
      <Button type="submit" size="xl" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}{isSubmitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
