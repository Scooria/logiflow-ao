import clsx from "clsx";
import { SampleDocument } from "../../lib/aiDemoData";
import { DOCUMENT_TYPE_LABEL_PT } from "../../types/ai";

const TYPE_ICON: Record<string, string> = {
  INVOICE: "🧾",
  PACKING_LIST: "📦",
  QUOTATION_EMAIL: "✉️",
};

export function SampleDocumentPicker({
  samples,
  selectedId,
  disabled,
  onSelect,
}: {
  samples: SampleDocument[];
  selectedId: string | null;
  disabled: boolean;
  onSelect: (sampleId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {samples.map((sample) => {
        const isSelected = sample.id === selectedId;
        return (
          <button
            key={sample.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(sample.id)}
            className={clsx(
              "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
              isSelected
                ? "border-[var(--color-series-1)] bg-[var(--color-series-1)]/5"
                : "border-[var(--color-grid)] bg-[var(--color-surface-1)] hover:border-[var(--color-baseline)]",
              disabled && !isSelected && "opacity-50"
            )}
          >
            <span className="text-xl" aria-hidden="true">
              {TYPE_ICON[sample.document.type]}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                {DOCUMENT_TYPE_LABEL_PT[sample.document.type]} — {sample.label}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">{sample.fileName}</span>
              <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{sample.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
