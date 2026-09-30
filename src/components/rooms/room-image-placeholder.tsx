import { BedDouble, Bed } from "lucide-react";

/** Shown until the admin uploads photos for a unit. */
export function RoomImagePlaceholder({ type, className = "" }: { type: "PRIVATE_ROOM" | "DORMITORY"; className?: string }) {
  const Icon = type === "DORMITORY" ? Bed : BedDouble;
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_top_left,var(--brand-soft),var(--sand-deep))] text-brand-deep/50 ${className}`}
      role="img"
      aria-label="No photo yet"
    >
      <Icon className="size-12" strokeWidth={1.25} />
    </div>
  );
}
