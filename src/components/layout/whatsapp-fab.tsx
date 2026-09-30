import { MessageCircle } from "lucide-react";
import { getSettings } from "@/lib/settings/service";
import { publicEnv } from "@/lib/env";
import { generalEnquiryMessage, whatsappLink } from "@/lib/whatsapp";

/** Floating "Contact Owner" WhatsApp button shown on every public page. */
export async function WhatsappFab() {
  const { property } = await getSettings();
  const number = property.whatsappNumber || publicEnv.whatsappNumber;
  if (!number) return null;
  return (
    <a
      href={whatsappLink(number, generalEnquiryMessage(property.name))}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded-full bg-[oklch(0.62_0.17_150)] px-4 py-3 text-sm font-semibold text-white shadow-lift transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 sm:right-6 sm:bottom-6"
      aria-label="Contact owner on WhatsApp"
    >
      <MessageCircle className="size-5" aria-hidden />
      <span className="hidden sm:inline">Contact Owner</span>
    </a>
  );
}
