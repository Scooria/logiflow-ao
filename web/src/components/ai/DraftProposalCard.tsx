import { Card } from "../ui/Card";
import { DraftBookingProposal } from "../../types/ai";
import { PROVINCE_NAME_PT } from "../../types/domain";

const MODE_LABEL: Record<string, string> = { AIR: "Aéreo", ROAD: "Rodoviário", MULTIMODAL: "Multimodal", UNKNOWN: "Por definir" };

export function DraftProposalCard({ proposal }: { proposal: DraftBookingProposal }) {
  return (
    <Card
      className="animate-fade-up"
      title="Proposta de Reserva (Rascunho)"
      subtitle="Gerada automaticamente a partir do documento confirmado — nenhuma reserva foi criada ainda."
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Modal Sugerido</p>
          <p className="mt-0.5 font-medium">{MODE_LABEL[proposal.suggestedMode]}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Expedidor</p>
          <p className="mt-0.5 font-medium">{proposal.shipperName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Consignatário</p>
          <p className="mt-0.5 font-medium">{proposal.consigneeName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Origem → Destino</p>
          <p className="mt-0.5 font-medium">
            {proposal.originProvince ? PROVINCE_NAME_PT[proposal.originProvince] : "—"} →{" "}
            {proposal.destinationProvince ? PROVINCE_NAME_PT[proposal.destinationProvince] : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Volumes</p>
          <p className="tabular mt-0.5 font-medium">{proposal.pieceCount}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Peso Bruto Total</p>
          <p className="tabular mt-0.5 font-medium">
            {proposal.totalGrossWeightKg !== null ? `${proposal.totalGrossWeightKg} kg` : "—"}
          </p>
        </div>
      </div>

      {proposal.missingFields.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-grid)] pt-4">
          <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">
            Campos em falta antes de emitir a Guia/AWB
          </p>
          <div className="flex flex-wrap gap-2">
            {proposal.missingFields.map((field) => (
              <span
                key={field}
                className="rounded-full bg-[var(--color-status-warning)]/15 px-2.5 py-1 text-xs font-medium text-[#8a5c00]"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-[var(--color-text-muted)]">
        Princípio de desenho: <strong className="text-[var(--color-text-secondary)]">a IA propõe, o humano confirma</strong> —
        finalizar esta reserva (e emitir a Guia de Transporte Rodoviário ou o AWB) é sempre uma acção explícita da
        operação, feita a partir do ecrã de operações, nunca automática.
      </p>
    </Card>
  );
}
