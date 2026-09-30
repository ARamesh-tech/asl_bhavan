import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forms/auth-forms";
import { AuthShell } from "@/components/layout/auth-shell";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" description="Enter your email and we will send you a reset link.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
