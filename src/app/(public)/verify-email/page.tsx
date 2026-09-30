import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { verifyEmail } from "@/lib/auth/service";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = { title: "Verify email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let ok = false;
  let message = "This verification link is invalid or has expired.";
  if (token) {
    try {
      await verifyEmail(token);
      ok = true;
      message = "Your email address has been verified. Thank you!";
    } catch (err) {
      if (isAppError(err)) message = err.message;
    }
  }
  return (
    <AuthShell title={ok ? "Email verified" : "Verification failed"} description={message}>
      <Button asChild size="xl" className="w-full"><Link href={ok ? "/my-bookings" : "/login"}>{ok ? "Go to my bookings" : "Sign in"}</Link></Button>
    </AuthShell>
  );
}
