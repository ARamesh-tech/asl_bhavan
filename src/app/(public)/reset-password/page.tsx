import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { AuthShell } from "@/components/layout/auth-shell";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <AuthShell title="Invalid link" description="This password reset link is missing its token.">
        <p className="text-center text-sm"><Link href="/forgot-password" className="text-brand underline">Request a new link</Link></p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
