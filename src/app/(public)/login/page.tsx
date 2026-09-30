import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/forms/auth-forms";
import { AuthShell } from "@/components/layout/auth-shell";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(isAdmin(user) ? "/admin" : "/my-bookings");
  return (
    <AuthShell title="Sign in" description="Access your bookings and receipts.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
