import { DEFAULT_TENANT_ID } from "../lib/api";
import { BarcodeScannerView } from "../components/scanner/BarcodeScannerView";

export default function ScannerPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Scanner de Código de Barras / QR</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Aponte a câmara a um código Code-128, GS1-128 ou QR para dar entrada/saída de stock.
      </p>
      <BarcodeScannerView scannedByUserId={`web-${DEFAULT_TENANT_ID}`} />
    </div>
  );
}
