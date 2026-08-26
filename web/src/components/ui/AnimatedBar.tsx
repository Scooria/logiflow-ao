import { useEffect, useState } from "react";

/** Barra horizontal que anima o preenchimento de 0 até `pct` quando aparece ou muda. */
export function AnimatedBar({ pct, color, trackClassName }: { pct: number; color: string; trackClassName?: string }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(Math.max(0, Math.min(100, pct))));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div className={trackClassName ?? "h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-grid)]"}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}
