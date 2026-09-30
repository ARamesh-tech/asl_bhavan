import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ContactForm } from "@/components/forms/contact-form";
import { PageHero } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/guards";
import { publicEnv } from "@/lib/env";
import { getSettings } from "@/lib/settings/service";
import { generalEnquiryMessage, telLink, whatsappLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const [{ property }, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const whatsapp = property.whatsappNumber || publicEnv.whatsappNumber;
  const maps = property.googleMapsUrl || publicEnv.googleMapsUrl;
  const address = [property.addressLine1, property.addressLine2, property.city, property.state, property.postalCode].filter(Boolean).join(", ");

  return (
    <>
      <PageHero eyebrow="Get in touch" title="Contact us" description="Questions about rooms, group stays or directions? We are happy to help." />
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
          <h2 className="text-xl font-semibold">Send a message</h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">We reply by email or WhatsApp, usually within a few hours.</p>
          <ContactForm defaults={user ? { name: user.name, email: user.email, phone: user.phone ?? "" } : undefined} />
        </div>
        <aside className="space-y-6">
          <div className="rounded-2xl bg-[linear-gradient(135deg,var(--brand),var(--brand-deep))] p-6 text-brand-foreground shadow-lift">
            <h2 className="text-lg font-semibold">Fastest: WhatsApp</h2>
            <p className="mt-1 text-sm text-brand-foreground/85">Chat directly with the owner for instant answers.</p>
            {whatsapp && <Button asChild size="xl" className="mt-4 w-full bg-white text-brand-deep hover:bg-white/90"><a href={whatsappLink(whatsapp, generalEnquiryMessage(property.name))} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden /> Open WhatsApp</a></Button>}
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">Contact details</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {property.phone && <li className="flex gap-3"><Phone className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /><a href={telLink(property.phone)} className="hover:underline">{property.phone}</a></li>}
              {property.email && <li className="flex gap-3"><Mail className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /><a href={`mailto:${property.email}`} className="hover:underline">{property.email}</a></li>}
              {address && <li className="flex gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />{maps ? <a href={maps} target="_blank" rel="noopener noreferrer" className="hover:underline">{address}</a> : address}</li>}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">Check-in {property.checkInTime} · Check-out {property.checkOutTime}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
