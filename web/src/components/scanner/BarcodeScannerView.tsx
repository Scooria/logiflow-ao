/**
 * Scanner de código de barras/QR via câmara do dispositivo.
 *
 * Usa @zxing/browser (multi-formato: Code-128, GS1-128 é decodificado como
 * Code-128 subjacente, QR Code, etc.) sobre um elemento <video> alimentado
 * por getUserMedia. Cada leitura bem-sucedida é debounced (mesma leitura
 * ignorada durante 1.5s) para não disparar dezenas de eventos por segundo
 * enquanto o código continua em frame, e é enviada para o backend via
 * `postBarcodeScan` (ver lib/api.ts), que em modo demonstração apenas simula
 * sucesso.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { postBarcodeScan, ScanBarcodePayload } from "../../lib/api";

const ACTIONS: { value: ScanBarcodePayload["action"]; label: string }[] = [
  { value: "INBOUND", label: "Entrada" },
  { value: "OUTBOUND", label: "Saída" },
  { value: "TRANSFER", label: "Transferência" },
  { value: "PUTAWAY", label: "Arrumação" },
  { value: "PICK", label: "Picking" },
  { value: "CYCLE_COUNT", label: "Contagem Cíclica" },
];

interface ScanLogEntry {
  id: string;
  value: string;
  action: ScanBarcodePayload["action"];
  at: Date;
  ok: boolean;
  demo: boolean;
}

const DUPLICATE_WINDOW_MS = 1500;

export function BarcodeScannerView({ scannedByUserId }: { scannedByUserId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastReadRef = useRef<{ value: string; at: number } | null>(null);

  const [action, setAction] = useState<ScanBarcodePayload["action"]>("INBOUND");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [log, setLog] = useState<ScanLogEntry[]>([]);

  const submitScan = useCallback(
    async (value: string) => {
      const now = Date.now();
      if (
        lastReadRef.current &&
        lastReadRef.current.value === value &&
        now - lastReadRef.current.at < DUPLICATE_WINDOW_MS
      ) {
        return; // leitura duplicada dentro da janela de debounce
      }
      lastReadRef.current = { value, at: now };

      const result = await postBarcodeScan({ barcodeValue: value, action, scannedByUserId });
      setLog((prev) => [
        { id: `${now}`, value, action, at: new Date(now), ok: result.ok, demo: result.demo },
        ...prev,
      ].slice(0, 20));
    },
    [action, scannedByUserId]
  );

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    async function start() {
      try {
        await BrowserMultiFormatReader.listVideoInputDevices();
        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(
          undefined, // deixa o zxing escolher a câmara traseira (environment-facing) quando disponível
          videoRef.current,
          (result) => {
            if (result) void submitScan(result.getText());
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setIsCameraActive(true);
        setCameraError(null);
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            "Não foi possível aceder à câmara. Verifique as permissões do navegador ou use a introdução manual abaixo."
          );
          console.error("[scanner] falha ao iniciar câmara", err);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // a câmara arranca uma única vez; `action` é lido via closure em submitScan (useCallback já actualizado)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="rounded-xl border border-[var(--color-grid)] bg-[var(--color-surface-1)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Câmara</h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              isCameraActive
                ? "bg-[var(--color-status-good)]/15 text-[var(--color-status-good)]"
                : "bg-[var(--color-baseline)]/20 text-[var(--color-text-secondary)]"
            }`}
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              {isCameraActive && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-status-good)] opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isCameraActive ? "bg-[var(--color-status-good)]" : "bg-[var(--color-text-muted)]"
                }`}
              />
            </span>
            {isCameraActive ? "Ativa" : "A iniciar…"}
          </span>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-2/3 w-2/3 rounded-lg border-2 border-white/70" />
          </div>
        </div>

        {cameraError && (
          <p className="mt-3 rounded-md bg-[var(--color-status-critical)]/10 p-3 text-sm text-[var(--color-status-critical)]">
            {cameraError}
          </p>
        )}

        <div className="mt-4">
          <label className="block text-xs font-medium text-[var(--color-text-muted)]">
            Introdução manual (fallback sem câmara)
          </label>
          <form
            className="mt-1 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (manualValue.trim()) {
                void submitScan(manualValue.trim());
                setManualValue("");
              }
            }}
          >
            <input
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="Ex.: AO-LUA-WH1-ZA-R04-L02-B12"
              className="flex-1 rounded-md border border-[var(--color-grid)] bg-[var(--color-page)] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-[var(--color-series-1)] px-4 py-2 text-sm font-medium text-white"
            >
              Registar
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-grid)] bg-[var(--color-surface-1)] p-5">
        <h2 className="text-sm font-semibold">Ação de armazém</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.value}
              onClick={() => setAction(a.value)}
              className={`rounded-md border px-3 py-2 text-xs font-medium ${
                action === a.value
                  ? "border-[var(--color-series-1)] bg-[var(--color-series-1)]/10 text-[var(--color-series-1)]"
                  : "border-[var(--color-grid)] text-[var(--color-text-secondary)]"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Leituras recentes
        </h3>
        {log.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Ainda sem leituras nesta sessão.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {log.map((entry) => (
              <li key={entry.id} className="animate-fade-up rounded-md border border-[var(--color-grid)] p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{entry.value}</span>
                  <span
                    className={entry.ok ? "text-[var(--color-status-good)]" : "text-[var(--color-status-critical)]"}
                  >
                    {entry.ok ? "✓" : "✕"}
                  </span>
                </div>
                <p className="mt-0.5 text-[var(--color-text-muted)]">
                  {ACTIONS.find((a) => a.value === entry.action)?.label} ·{" "}
                  {entry.at.toLocaleTimeString("pt-AO")}
                  {entry.demo && " · demo"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
