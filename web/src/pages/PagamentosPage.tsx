import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CreditCard, Landmark, Wallet } from "lucide-react";
import { Card } from "../components/ui/Card";
import { fetchEmisPayments, isDemoMode, requestMulticaixaReference, requestStripeCheckout } from "../lib/api";
import {
  MulticaixaReference,
  RupeReference,
  StripeCheckoutResult,
  generateMulticaixaReference,
  generateRupeReference,
  simulateStripeCheckout,
} from "../lib/payments";

type Method = "MULTICAIXA" | "RUPE" | "STRIPE";
type Receipt = MulticaixaReference | RupeReference | StripeCheckoutResult;

const METHODS: { id: Method; label: string; icon: typeof Wallet }[] = [
  { id: "MULTICAIXA", label: "Multicaixa (EMIS)", icon: Wallet },
  { id: "RUPE", label: "RUPE (AGT)", icon: Landmark },
  { id: "STRIPE", label: "Stripe Internacional", icon: CreditCard },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-AO", { dateStyle: "medium", timeStyle: "short" });
}

function ReceiptCard({ receipt, onReset }: { receipt: Receipt; onReset: () => void }) {
  return (
    <Card className="animate-fade-up">
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <CircleCheck className="h-9 w-9 text-[var(--color-status-good)]" />
        <h3 className="text-base font-semibold">Comprovativo</h3>
      </div>

      <div className="mt-2 space-y-2.5 rounded-lg border border-[var(--color-grid)] bg-[var(--color-page)] p-4 text-sm">
        {receipt.kind === "MULTICAIXA" && (
          <>
            <Row label="Entidade" value={receipt.entity} mono />
            <Row label="Referência" value={receipt.reference} mono />
            <Row label="Montante" value={`${receipt.amount.toLocaleString("pt-AO")} AOA`} />
            <Row label="Descrição" value={receipt.description} />
            <Row label="Emitido em" value={formatDateTime(receipt.issuedAt)} />
            <Row label="Válido até" value={formatDateTime(receipt.expiresAt)} />
          </>
        )}
        {receipt.kind === "RUPE" && (
          <>
            <Row label="Nº RUPE" value={receipt.rupeNumber} mono />
            <Row label="NIF do Contribuinte" value={receipt.nif} mono />
            <Row label="Montante" value={`${receipt.amount.toLocaleString("pt-AO")} AOA`} />
            <Row label="Descrição" value={receipt.description} />
            <Row label="Emitido em" value={formatDateTime(receipt.issuedAt)} />
            <Row label="Válido até" value={formatDateTime(receipt.validUntil)} />
          </>
        )}
        {receipt.kind === "STRIPE" && (
          <>
            <Row label="Sessão Stripe" value={receipt.sessionId} mono />
            <Row label="Estado" value="Pago" />
            <Row label="Montante" value={`${receipt.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${receipt.currency}`} />
            <Row label="Cartão" value={`•••• ${receipt.cardLast4}`} mono />
            <Row label="Descrição" value={receipt.description} />
            <Row label="Pago em" value={formatDateTime(receipt.paidAt)} />
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-[var(--color-text-muted)]">
        {isDemoMode()
          ? "Modo demonstração — sem backend ligado, este comprovativo é simulado."
          : receipt.kind === "RUPE"
            ? "RUPE ainda não tem integração real (requer acesso ao webservice da AGT) — comprovativo simulado. Ver DEPLOY.md."
            : "Comprovativo emitido pela integração real do backend (EMIS/Stripe)."}
      </p>

      <button
        type="button"
        onClick={onReset}
        className="mt-4 w-full rounded-md border border-[var(--color-grid)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-page)]"
      >
        Nova simulação
      </button>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className={mono ? "font-mono font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}

function MulticaixaForm({ onIssued }: { onIssued: (r: MulticaixaReference) => void }) {
  const [amount, setAmount] = useState("150000");
  const [description, setDescription] = useState("Frete rodoviário — Luanda → Huambo");
  const paymentsQuery = useQuery({ queryKey: ["emis-payments"], queryFn: fetchEmisPayments });
  const pending = (paymentsQuery.data ?? []).filter((p) => p.status === "PENDING" || p.status === "PROCESSING").slice(0, 4);

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;
    setSubmitting(true);
    try {
      // Se houver backend ligado (VITE_API_BASE_URL), gera uma Referência
      // Multicaixa REAL via EMIS (src/modules/payments/emis.service.ts);
      // caso contrário (ou se o pedido falhar) cai no simulador local.
      const real = await requestMulticaixaReference({ amount: value, description });
      if (real) {
        onIssued({
          kind: "MULTICAIXA",
          entity: real.entity,
          reference: real.reference,
          amount: value,
          currency: "AOA",
          description,
          issuedAt: real.issuedAt,
          expiresAt: real.expiresAt,
        });
      } else {
        onIssued(generateMulticaixaReference({ amount: value, description }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {pending.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-[var(--color-text-muted)]">Pagamentos EMIS pendentes</p>
          <div className="flex flex-wrap gap-1.5">
            {pending.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setAmount(String(p.amount));
                  setDescription(`Referência ${p.emisReference}`);
                }}
                className="rounded-full border border-[var(--color-grid)] px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-series-1)] hover:text-[var(--color-series-1)]"
              >
                {p.emisReference} · {p.amount.toLocaleString("pt-AO")} AOA
              </button>
            ))}
          </div>
        </div>
      )}
      <FormFields amount={amount} setAmount={setAmount} description={description} setDescription={setDescription} currencyLabel="AOA" />
      <SubmitButton label={submitting ? "A gerar…" : "Gerar Referência Multicaixa"} disabled={submitting} />
    </form>
  );
}

function RupeForm({ onIssued }: { onIssued: (r: RupeReference) => void }) {
  const [amount, setAmount] = useState("84000");
  const [description, setDescription] = useState("Direitos aduaneiros — importação farmacêutica");
  const [nif, setNif] = useState("5417839210");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0 || !nif.trim()) return;
    onIssued(generateRupeReference({ amount: value, description, nif: nif.trim() }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-[var(--color-text-secondary)]">NIF do Contribuinte</span>
        <input
          value={nif}
          onChange={(e) => setNif(e.target.value)}
          className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-2 text-sm"
        />
      </label>
      <FormFields amount={amount} setAmount={setAmount} description={description} setDescription={setDescription} currencyLabel="AOA" />
      <SubmitButton label="Gerar RUPE" />
    </form>
  );
}

function StripeForm({ onIssued }: { onIssued: (r: StripeCheckoutResult) => void }) {
  const [amount, setAmount] = useState("2450.00");
  const [currency, setCurrency] = useState<"USD" | "EUR">("USD");
  const [description, setDescription] = useState("International freight — AWB 649-1234567");
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;
    setSubmitting(true);
    try {
      // Se houver backend ligado, cria uma Stripe Checkout Session REAL
      // (src/modules/payments/stripe.service.ts) e redireciona para a
      // página de pagamento hospedada pela própria Stripe — não é possível
      // (nem seguro) simular esse redireccionamento, por isso não há
      // comprovativo local neste caminho: o utilizador só volta à app após
      // o pagamento real, via STRIPE_SUCCESS_URL. Sem backend, mantém-se a
      // simulação local para a demonstração ser sempre navegável.
      const real = await requestStripeCheckout({ amount: value, currency, description });
      if (real) {
        window.location.href = real.checkoutUrl;
        return;
      }
      onIssued(simulateStripeCheckout({ amount: value, currency, description }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--color-text-secondary)]">Montante</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--color-text-secondary)]">Moeda</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "USD" | "EUR")}
            className="rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-2 text-sm"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-[var(--color-text-secondary)]">Descrição</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-[var(--color-text-secondary)]">Cartão (demonstração)</span>
        <input
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-2 text-sm font-mono"
        />
      </label>
      <SubmitButton label={submitting ? "A processar…" : "Pagar com Stripe"} disabled={submitting} />
    </form>
  );
}

function FormFields({
  amount,
  setAmount,
  description,
  setDescription,
  currencyLabel,
}: {
  amount: string;
  setAmount: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  currencyLabel: string;
}) {
  return (
    <>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-[var(--color-text-secondary)]">Montante ({currencyLabel})</span>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-[var(--color-text-secondary)]">Descrição</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-2 text-sm"
        />
      </label>
    </>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-md bg-[var(--color-series-1)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}

export default function PagamentosPage() {
  const [method, setMethod] = useState<Method>("MULTICAIXA");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-xl font-semibold">Terminal de Pagamentos</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Emissão instantânea de referência Multicaixa (EMIS), RUPE (AGT) para direitos aduaneiros, e checkout Stripe
        para clientes internacionais.
      </p>

      {receipt ? (
        <ReceiptCard receipt={receipt} onReset={() => setReceipt(null)} />
      ) : (
        <Card>
          <div className="mb-5 flex gap-1 rounded-lg bg-[var(--color-page)] p-1 text-sm">
            {METHODS.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium sm:text-sm ${
                    method === m.id
                      ? "bg-[var(--color-surface-1)] text-[var(--color-text-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {method === "MULTICAIXA" && <MulticaixaForm onIssued={setReceipt} />}
          {method === "RUPE" && <RupeForm onIssued={setReceipt} />}
          {method === "STRIPE" && <StripeForm onIssued={setReceipt} />}
        </Card>
      )}
    </div>
  );
}
