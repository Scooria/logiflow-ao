/**
 * Codificação de cor por MAGNITUDE (ocupação %) — hue único sequencial
 * (azul), claro->escuro, conforme a skill dataviz. Nunca usar a paleta
 * categórica aqui: ocupação é uma grandeza contínua, não uma identidade.
 */
const SEQUENTIAL_STEPS = [
  "var(--color-seq-100)",
  "var(--color-seq-200)",
  "var(--color-seq-300)",
  "var(--color-seq-400)",
  "var(--color-seq-500)",
  "var(--color-seq-600)",
  "var(--color-seq-700)",
];

export function occupancyPercent(occupiedUnits: number, capacityUnits: number | null): number | null {
  if (!capacityUnits || capacityUnits <= 0) return null;
  return Math.min(100, Math.round((occupiedUnits / capacityUnits) * 100));
}

export function occupancyColor(occupiedUnits: number, capacityUnits: number | null): string {
  const pct = occupancyPercent(occupiedUnits, capacityUnits);
  if (pct === null) return "var(--color-baseline)";
  const index = Math.min(SEQUENTIAL_STEPS.length - 1, Math.floor((pct / 100) * SEQUENTIAL_STEPS.length));
  return SEQUENTIAL_STEPS[index];
}

/** Texto de contraste (branco/preto) legível sobre o passo sequencial escolhido. */
export function occupancyTextColor(occupiedUnits: number, capacityUnits: number | null): string {
  const pct = occupancyPercent(occupiedUnits, capacityUnits);
  if (pct === null || pct < 60) return "var(--color-text-primary)";
  return "#ffffff";
}
