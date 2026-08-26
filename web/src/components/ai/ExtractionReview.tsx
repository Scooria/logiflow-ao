import { Card } from "../ui/Card";
import { StatTile } from "../ui/StatTile";
import {
  DOCUMENT_STATUS_LABEL_PT,
  DocumentStatus,
  IngestedDocument,
  InvoiceExtraction,
  PackingListExtraction,
  QuotationEmailExtraction,
} from "../../types/ai";
import { PROVINCE_NAME_PT } from "../../types/domain";

function Field({ label, value }: { label: string; value: string | number | null }) {
  const missing = value === null || value === undefined || value === "";
  return (
    <div className="border-b border-[var(--color-grid)] py-2 last:border-b-0">
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p
        className={
          missing
            ? "mt-0.5 text-sm italic text-[var(--color-status-warning)]"
            : "mt-0.5 text-sm font-medium text-[var(--color-text-primary)]"
        }
      >
        {missing ? "Não identificado — requer confirmação humana" : value}
      </p>
    </div>
  );
}

function InvoiceFields({ data }: { data: InvoiceExtraction }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6">
        <Field label="Nº Fatura" value={data.invoiceNumber} />
        <Field label="Data de Emissão" value={data.issueDate} />
        <Field label="Vendedor" value={data.sellerName} />
        <Field label="NIF Vendedor" value={data.sellerNif} />
        <Field label="Comprador" value={data.buyerName} />
        <Field label="NIF Comprador" value={data.buyerNif} />
        <Field label="Moeda" value={data.currency} />
        <Field label="Valor Total" value={data.totalAmount !== null ? `${data.totalAmount.toLocaleString("pt-PT")} ${data.currency ?? ""}` : null} />
      </div>
      <p className="mb-2 mt-4 text-xs font-medium text-[var(--color-text-muted)]">Linhas de Artigo</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--color-grid)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--color-page)] text-xs text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Descrição</th>
              <th className="px-3 py-2 font-medium">Qtd.</th>
              <th className="px-3 py-2 font-medium">Preço Unit.</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item, i) => (
              <tr key={i} className="border-t border-[var(--color-grid)]">
                <td className="px-3 py-2">{item.description}</td>
                <td className="tabular px-3 py-2">{item.quantity ?? "—"}</td>
                <td className="tabular px-3 py-2">{item.unitPrice ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PackingListFields({ data }: { data: PackingListExtraction }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6">
        <Field label="Referência" value={data.referenceNumber} />
        <Field label="Peso Bruto Total" value={data.totalGrossWeightKg !== null ? `${data.totalGrossWeightKg} kg` : null} />
        <Field label="Expedidor" value={data.shipperName} />
        <Field label="Consignatário" value={data.consigneeName} />
      </div>
      <p className="mb-2 mt-4 text-xs font-medium text-[var(--color-text-muted)]">Volumes</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--color-grid)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--color-page)] text-xs text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Descrição</th>
              <th className="px-3 py-2 font-medium">Qtd.</th>
              <th className="px-3 py-2 font-medium">C×L×A (cm)</th>
              <th className="px-3 py-2 font-medium">Peso (kg)</th>
            </tr>
          </thead>
          <tbody>
            {data.pieces.map((p, i) => {
              const incomplete = p.heightCm === null || p.grossWeightKg === null;
              return (
                <tr key={i} className="border-t border-[var(--color-grid)]">
                  <td className="px-3 py-2">{p.description}</td>
                  <td className="tabular px-3 py-2">{p.quantity}</td>
                  <td className="tabular px-3 py-2">
                    {p.lengthCm ?? "—"}×{p.widthCm ?? "—"}×{p.heightCm ?? "—"}
                  </td>
                  <td className={`tabular px-3 py-2 ${incomplete ? "text-[var(--color-status-warning)]" : ""}`}>
                    {p.grossWeightKg ?? "por confirmar"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuotationFields({ data }: { data: QuotationEmailExtraction }) {
  return (
    <div className="grid grid-cols-2 gap-x-6">
      <Field label="Modal Solicitado" value={data.requestedMode === "UNKNOWN" ? null : data.requestedMode === "AIR" ? "Aéreo" : "Rodoviário"} />
      <Field label="Data Pretendida" value={data.targetDate} />
      <Field label="Província de Origem" value={data.originProvince ? PROVINCE_NAME_PT[data.originProvince] : null} />
      <Field label="Província de Destino" value={data.destinationProvince ? PROVINCE_NAME_PT[data.destinationProvince] : null} />
      <Field label="Solicitante" value={data.requesterName} />
      <Field label="Empresa" value={data.requesterCompany} />
      <Field label="Peso Aproximado" value={data.approxWeightKg !== null ? `${data.approxWeightKg} kg` : null} />
      <Field label="Descrição da Carga" value={data.cargoDescription} />
    </div>
  );
}

export function ExtractionReview({
  document,
  status,
  onConfirm,
  onReject,
  isSubmitting,
}: {
  document: IngestedDocument;
  status: DocumentStatus;
  onConfirm: () => void;
  onReject: () => void;
  isSubmitting: boolean;
}) {
  const payload = document.extractedPayload;
  const confidencePct = Math.round(document.confidenceScore * 100);
  const confidenceTone = confidencePct >= 90 ? "good" : confidencePct >= 75 ? "warning" : "critical";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Confiança da Extração" countTo={confidencePct} suffix="%" tone={confidenceTone} delayMs={0} />
        <StatTile label="Modelo" value={document.modelUsed ?? "—"} delayMs={60} />
        <StatTile
          label="Estado"
          value={DOCUMENT_STATUS_LABEL_PT[status]}
          tone={status === "CONFIRMED" ? "good" : status === "REJECTED" ? "critical" : "neutral"}
          delayMs={120}
        />
      </div>

      {"needsReview" in payload && payload.needsReview && (
        <div className="rounded-lg border border-[var(--color-status-warning)]/40 bg-[var(--color-status-warning)]/10 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          <span className="mr-1.5" aria-hidden="true">
            ⚠
          </span>
          <strong className="text-[var(--color-text-primary)]">Requer atenção humana:</strong> {payload.notes}
        </div>
      )}

      <Card title="Campos Extraídos" subtitle="Revê os campos antes de confirmar — a IA propõe, a operação confirma.">
        {document.type === "INVOICE" && <InvoiceFields data={payload as InvoiceExtraction} />}
        {document.type === "PACKING_LIST" && <PackingListFields data={payload as PackingListExtraction} />}
        {document.type === "QUOTATION_EMAIL" && <QuotationFields data={payload as QuotationEmailExtraction} />}
      </Card>

      {status === "PENDING_REVIEW" && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-md bg-[var(--color-series-1)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            ✓ Confirmar Extração
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={isSubmitting}
            className="rounded-md border border-[var(--color-grid)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-page)] disabled:opacity-50"
          >
            ✕ Rejeitar
          </button>
        </div>
      )}
    </div>
  );
}
