import { useEffect, useRef, useState } from "react";

/**
 * Anima um valor numérico a subir/descer suavemente até `target` sempre que
 * ele muda — usado nos StatTiles para que uma actualização de dados (real ou
 * por polling) se sinta "viva" em vez de um número a trocar instantaneamente.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    let start: number | null = null;
    function step(ts: number) {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    }
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
