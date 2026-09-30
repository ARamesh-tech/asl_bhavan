import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RegisterForm } from "@/components/forms/auth-forms";
import { AuthShell } from "@/components/layout/auth-shell";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/my-bookings");
  return (
    <AuthShell title="Create your account" description="Book faster and keep all your receipts in one place.">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
