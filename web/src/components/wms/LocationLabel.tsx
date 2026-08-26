/**
 * Etiqueta de posição — código de barras Code-128 (via jsbarcode, SVG real,
 * decodificável pelo Scanner desta aplicação) + QR code (via qrcode, PNG
 * embutido) para o endereço único da posição. Reflecte o que sairia
 * fisicamente impresso numa etiqueta de prateleira no armazém.
 */
import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";

export function LocationLabel({ uniqueAddress }: { uniqueAddress: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, uniqueAddress, {
        format: "CODE128",
        width: 1.6,
        height: 42,
        displayValue: false,
        margin: 0,
        background: "transparent",
        lineColor: "currentColor",
      });
    } catch {
      // endereço com caracteres fora do alfabeto Code-128 — improvável neste esquema, mas não deve rebentar a UI.
    }
  }, [uniqueAddress]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(uniqueAddress, { margin: 1, width: 96, color: { dark: "#0b0b0b", light: "#ffffff" } }).then(
      (url) => {
        if (!cancelled) setQrDataUrl(url);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uniqueAddress]);

  return (
    <div className="rounded-lg border border-dashed border-[var(--color-grid)] p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        <QrCode className="h-3.5 w-3.5" /> Etiqueta da Posição
      </p>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1 overflow-x-auto text-[var(--color-text-primary)]">
          <svg ref={svgRef} className="h-auto max-w-full" />
        </div>
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt={`Código QR de ${uniqueAddress}`}
            className="h-16 w-16 shrink-0 rounded border border-[var(--color-grid)] bg-white p-1"
          />
        )}
      </div>
      <p className="mt-2 text-center font-mono text-[10px] text-[var(--color-text-secondary)]">{uniqueAddress}</p>
      <p className="mt-1 text-center text-[10px] text-[var(--color-text-muted)]">
        Testa no Scanner — introdução manual aceita este código.
      </p>
    </div>
  );
}
