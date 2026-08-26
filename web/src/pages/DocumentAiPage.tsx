import { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { SampleDocumentPicker } from "../components/ai/SampleDocumentPicker";
import { ExtractionReview } from "../components/ai/ExtractionReview";
import { DraftProposalCard } from "../components/ai/DraftProposalCard";
import {
  analyzeSampleDocument,
  DOCUMENT_ANALYSIS_DELAY_MS,
  fetchDraftProposal,
  submitDocumentReview,
} from "../lib/api";
import { SAMPLE_DOCUMENTS } from "../lib/aiDemoData";
import { DocumentStatus, DraftBookingProposal, IngestedDocument } from "../types/ai";

type Phase = "idle" | "processing" | "ready";

const PROCESSING_STEPS = ["A ler o documento…", "A extrair campos estruturados…", "A validar com Zod…"];

function ProcessingIndicator() {
  const [stepIndex, setStepIndex] = useState(0);
  const [pct, setPct] = useState(4);

  useEffect(() => {
    const stepMs = DOCUMENT_ANALYSIS_DELAY_MS / PROCESSING_STEPS.length;
    const stepTimer = setInterval(() => setStepIndex((i) => Math.min(i + 1, PROCESSING_STEPS.length - 1)), stepMs);
    const growTimer = requestAnimationFrame(() => setPct(96));
    return () => {
      clearInterval(stepTimer);
      cancelAnimationFrame(growTimer);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-series-1)] border-t-transparent"
        role="status"
        aria-label="A processar"
      />
      <p className="text-sm text-[var(--color-text-secondary)]">
        {PROCESSING_STEPS[stepIndex]} <span className="text-[var(--color-text-muted)]">Claude Sonnet 4.5</span>
      </p>
      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--color-grid)]">
        <div
          className="h-full rounded-full bg-[var(--color-series-1)] transition-[width] ease-out"
          style={{ width: `${pct}%`, transitionDuration: `${DOCUMENT_ANALYSIS_DELAY_MS}ms` }}
        />
      </div>
    </div>
  );
}

export default function DocumentAiPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [document, setDocumentState] = useState<IngestedDocument | null>(null);
  const [status, setStatus] = useState<DocumentStatus>("PENDING_REVIEW");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proposal, setProposal] = useState<DraftBookingProposal | null>(null);

  async function handleSelect(sampleId: string) {
    setSelectedId(sampleId);
    setPhase("processing");
    setDocumentState(null);
    setProposal(null);
    const result = await analyzeSampleDocument(sampleId);
    setDocumentState(result);
    setStatus(result.status);
    setPhase("ready");
  }

  async function handleConfirm() {
    if (!document) return;
    setIsSubmitting(true);
    const result = await submitDocumentReview({ documentId: document.id, action: "CONFIRM" });
    setStatus(result.status);
    const draft = await fetchDraftProposal(document.id);
    setProposal(draft);
    setIsSubmitting(false);
  }

  async function handleReject() {
    if (!document) return;
    setIsSubmitting(true);
    const result = await submitDocumentReview({ documentId: document.id, action: "REJECT" });
    setStatus(result.status);
    setIsSubmitting(false);
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Document AI — Extração Inteligente</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Faturas, packing lists e emails de cotação processados automaticamente. A IA extrai os campos e propõe
        uma reserva — a confirmação final é sempre humana.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <div>
          <Card title="1. Escolher Documento" subtitle="Exemplos representativos para esta demonstração">
            <SampleDocumentPicker
              samples={SAMPLE_DOCUMENTS}
              selectedId={selectedId}
              disabled={phase === "processing"}
              onSelect={handleSelect}
            />
          </Card>
        </div>

        <div className="space-y-4">
          {phase === "idle" && (
            <Card>
              <EmptyState message="Escolhe um documento de exemplo à esquerda para veres a extração da IA." />
            </Card>
          )}

          {phase === "processing" && (
            <Card>
              <ProcessingIndicator />
            </Card>
          )}

          {phase === "ready" && document && (
            <div className="animate-fade-up space-y-4">
              <ExtractionReview
                document={document}
                status={status}
                onConfirm={handleConfirm}
                onReject={handleReject}
                isSubmitting={isSubmitting}
              />
              {proposal && <DraftProposalCard proposal={proposal} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
