/**
 * Stat tile — figura grande + rótulo + delta opcional. Segue a convenção da
 * skill dataviz: figuras em algarismos proporcionais, tabular-nums apenas
 * quando é preciso alinhar em coluna (não é o caso aqui).
 */
import clsx from "clsx";
import { useCountUp } from "../../lib/useCountUp";

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  countTo,
  suffix = "",
  prefix = "",
  thousands = false,
  delayMs = 0,
}: {
  label: string;
  /** Usado directamente quando `countTo` não é fornecido (ex.: texto, "n/d"). */
  value?: string;
  hint?: string;
  tone?: "neutral" | "good" | "warning" | "critical";
  /** Quando definido, o número anima a subir/descer suavemente até este valor. */
  countTo?: number;
  suffix?: string;
  prefix?: string;
  /** Formata o número animado com separador de milhares (pt-AO) — para montantes. */
  thousands?: boolean;
  /** Atraso de entrada (ms) — usado para um efeito em cascata numa grelha de tiles. */
  delayMs?: number;
}) {
  const animated = useCountUp(countTo ?? 0);
  const formattedNumber = thousands ? animated.toLocaleString("pt-AO") : String(animated);
  const display = countTo !== undefined ? `${prefix}${formattedNumber}${suffix}` : value ?? "—";

  const toneClass =
    tone === "good"
      ? "text-[var(--color-status-good)]"
      : tone === "warning"
      ? "text-[var(--color-status-warning)]"
      : tone === "critical"
      ? "text-[var(--color-status-critical)]"
      : "text-[var(--color-text-primary)]";

  return (
    <div
      className="animate-fade-up rounded-xl border border-[var(--color-grid)] bg-[var(--color-surface-1)] p-4 transition-shadow hover:shadow-md"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className={clsx("tabular mt-1 text-2xl font-semibold", toneClass)}>{display}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{hint}</p>}
    </div>
  );
}
