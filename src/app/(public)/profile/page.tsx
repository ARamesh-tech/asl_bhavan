import type { Metadata } from "next";
import Link from "next/link";
import { ChangePasswordForm, ProfileForm } from "@/components/forms/account-forms";
import { PageHero } from "@/components/layout/section";
import { requireUserOrRedirect } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile", robots: { index: false } };

export default async function ProfilePage() {
  const user = await requireUserOrRedirect("/profile");
  return (
    <>
      <PageHero eyebrow="Account" title="Your profile" description="Keep your contact details current so the owner can reach you about your stay." />
      <div className="container-page grid gap-10 py-10 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6 shadow-soft">
          <h2 className="text-lg font-semibold">Contact details</h2>
          {!user.emailVerifiedAt && (
            <p className="mt-2 rounded-lg bg-status-partial-soft px-3 py-2 text-xs text-[oklch(0.45_0.12_75)]">Your email is not verified yet. Check your inbox for the verification link.</p>
          )}
          <div className="mt-5"><ProfileForm defaults={{ name: user.name, phone: user.phone ?? "", email: user.email }} /></div>
        </section>
        <section className="rounded-2xl border bg-card p-6 shadow-soft">
          <h2 className="text-lg font-semibold">Password</h2>
          <p className="mt-1 text-sm text-muted-foreground">Forgot it? Use <Link href="/forgot-password" className="underline">reset by email</Link> instead.</p>
          <div className="mt-5"><ChangePasswordForm /></div>
        </section>
      </div>
    </>
  );
}
