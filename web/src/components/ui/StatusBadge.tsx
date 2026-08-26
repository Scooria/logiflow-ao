import { SHIPMENT_STATUS_LABEL_PT, SHIPMENT_STATUS_SEMANTIC, ShipmentStatus } from "../../types/domain";

const SEMANTIC_STYLE: Record<string, string> = {
  neutral: "bg-[var(--color-baseline)]/20 text-[var(--color-text-secondary)]",
  progress: "bg-[var(--color-series-1)]/15 text-[var(--color-series-1)]",
  good: "bg-[var(--color-status-good)]/15 text-[var(--color-status-good)]",
  warning: "bg-[var(--color-status-warning)]/20 text-[#8a5c00]",
  critical: "bg-[var(--color-status-critical)]/15 text-[var(--color-status-critical)]",
};

const SEMANTIC_ICON: Record<string, string> = {
  neutral: "●",
  progress: "▶",
  good: "✓",
  warning: "▲",
  critical: "✕",
};

/** Badge de estado — nunca cor sozinha: ícone + rótulo sempre presentes. */
export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const semantic = SHIPMENT_STATUS_SEMANTIC[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${SEMANTIC_STYLE[semantic]}`}
    >
      <span aria-hidden="true">{SEMANTIC_ICON[semantic]}</span>
      {SHIPMENT_STATUS_LABEL_PT[status]}
    </span>
  );
}
