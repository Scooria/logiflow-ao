import { useEffect, useState } from "react";

/** Força um re-render periódico para o texto "há Xs" avançar sem re-buscar dados. */
function useTicker(intervalMs: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

/** Indicador "ao vivo" — ponto a pulsar + segundos desde a última actualização dos dados. */
export function LiveIndicator({ updatedAt }: { updatedAt: number | undefined }) {
  useTicker(1000);
  if (!updatedAt) return null;
  const seconds = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-status-good)] opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-status-good)]" />
      </span>
      {seconds <= 1 ? "Atualizado agora" : `Atualizado há ${seconds}s`}
    </span>
  );
}
