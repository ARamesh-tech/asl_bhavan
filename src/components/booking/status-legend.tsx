export type NightStatus = "AVAILABLE" | "PARTIALLY_AVAILABLE" | "BOOKED" | "BLOCKED" | "MAINTENANCE" | "CHECKED_IN";

/**
 * Shared visual vocabulary for availability. Each status has a colour token, a symbol and
 * a text label — the UI always shows at least two of the three (WCAG 1.4.1).
 */
export const statusStyles: Record<NightStatus, { label: string; symbol: string; cell: string; dot: string }> = {
  AVAILABLE: { label: "Available", symbol: "✓", cell: "bg-status-available-soft border-status-available/30 text-status-available", dot: "bg-status-available" },
  PARTIALLY_AVAILABLE: { label: "Partially available", symbol: "◐", cell: "bg-status-partial-soft border-status-partial/40 text-[oklch(0.45_0.12_75)]", dot: "bg-status-partial" },
  BOOKED: { label: "Booked", symbol: "✕", cell: "bg-status-booked-soft border-status-booked/30 text-status-booked", dot: "bg-status-booked" },
  BLOCKED: { label: "Blocked", symbol: "–", cell: "bg-status-blocked-soft border-status-blocked/30 text-status-blocked", dot: "bg-status-blocked" },
  MAINTENANCE: { label: "Maintenance", symbol: "⚒", cell: "bg-status-maintenance-soft border-status-maintenance/30 text-status-maintenance", dot: "bg-status-maintenance" },
  CHECKED_IN: { label: "Checked in", symbol: "●", cell: "bg-status-checked-in-soft border-status-checked-in/30 text-status-checked-in", dot: "bg-status-checked-in" },
};

export function StatusLegend({ className = "", dormitory = false, statuses }: { className?: string; dormitory?: boolean; statuses?: NightStatus[] }) {
  const items = statuses ?? (dormitory ? ["AVAILABLE", "PARTIALLY_AVAILABLE", "BOOKED", "BLOCKED"] : ["AVAILABLE", "BOOKED", "BLOCKED"]);
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground ${className}`} aria-label="Legend">
      {items.map((s) => (
        <li key={s} className="inline-flex items-center gap-1.5">
          <span className={`inline-block size-2.5 rounded-full ${statusStyles[s].dot}`} aria-hidden />
          <span aria-hidden>{statusStyles[s].symbol}</span> {statusStyles[s].label}{dormitory && s === "PARTIALLY_AVAILABLE" ? " (number = free beds)" : ""}
        </li>
      ))}
    </ul>
  );
}
