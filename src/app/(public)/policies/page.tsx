import type { Metadata } from "next";
import { PageHero } from "@/components/layout/section";
import { getSettings } from "@/lib/settings/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Policies" };

export default async function PoliciesPage() {
  const { policies, property } = await getSettings();
  const sections = [
    { id: "booking", title: "Booking instructions", body: policies.bookingInstructions },
    { id: "cancellation", title: "Cancellation policy", body: policies.cancellationPolicy },
    { id: "rules", title: "House rules", body: policies.houseRules },
    { id: "terms", title: "Terms and conditions", body: policies.termsAndConditions },
    { id: "privacy", title: "Privacy policy", body: policies.privacyPolicy },
  ];
  return (
    <>
      <PageHero eyebrow={property.name} title="Policies" description="Everything you need to know before you book." />
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Policy sections" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col">
            {sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="inline-block rounded-md px-3 py-1.5 text-sm hover:bg-muted">{s.title}</a></li>)}
          </ul>
        </nav>
        <div className="max-w-3xl space-y-12">
          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
              <h2 id={`${s.id}-h`} className="text-2xl font-semibold">{s.title}</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
