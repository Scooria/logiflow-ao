import { useState } from "react";
import clsx from "clsx";
import { ScriptedToolCall } from "../../lib/aiDemoData";

const TOOL_LABEL_PT: Record<string, string> = {
  find_route: "Calcular Rota",
  calculate_chargeable_weight: "Calcular Peso Taxável",
  list_shipments: "Listar Envios",
  get_shipment_tracking: "Consultar Rastreamento",
  generate_multicaixa_reference: "Gerar Referência Multicaixa",
};

function Json({ value }: { value: unknown }) {
  return (
    <pre className="tabular overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-[var(--color-page)] p-2.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function ToolCallCard({ call }: { call: ScriptedToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const isFinancial = call.name === "generate_multicaixa_reference";

  return (
    <div className="rounded-lg border border-[var(--color-grid)] bg-[var(--color-surface-1)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
          <span aria-hidden="true">{isFinancial ? "💳" : "🔧"}</span>
          Ferramenta: {TOOL_LABEL_PT[call.name] ?? call.name}
        </span>
        <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          detalhes
          <span
            className={clsx("inline-block transition-transform duration-300", expanded && "rotate-180")}
            aria-hidden="true"
          >
            ▾
          </span>
        </span>
      </button>
      <div
        className={clsx(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-[var(--color-grid)] p-3">
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                Entrada
              </p>
              <Json value={call.input} />
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                Resultado
              </p>
              <Json value={call.result} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
