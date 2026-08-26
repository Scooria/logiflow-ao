import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, Plane, Plus, Trash2, Truck } from "lucide-react";
import { Card } from "../components/ui/Card";
import { StatTile } from "../components/ui/StatTile";
import { useShipments } from "../lib/ShipmentsContext";
import { PROVINCE_NAME_PT, Province, Shipment } from "../types/domain";
import {
  DOMESTIC_AIR_DESTINATIONS,
  INTERNATIONAL_DESTINATIONS,
  PieceInput,
  formatAwbNumber,
  generateRoadGuideNumber,
  generateShipmentNumber,
  summarizeChargeableWeight,
} from "../lib/expedition";

const ALL_PROVINCES = Object.keys(PROVINCE_NAME_PT) as Province[];

function emptyPiece(): PieceInput {
  return { quantity: 1, lengthCm: 0, widthCm: 0, heightCm: 0, grossWeightKg: 0 };
}

interface SubmissionResult {
  shipment: Shipment;
  awb?: string;
  guia?: string;
}

export default function NovaExpedicaoPage() {
  const { addShipment } = useShipments();

  const [mode, setMode] = useState<"AIR" | "ROAD">("ROAD");
  const [destinationScope, setDestinationScope] = useState<"NACIONAL" | "INTERNACIONAL">("NACIONAL");
  const [originProvince, setOriginProvince] = useState<Province>("LUANDA");
  const [destinationProvince, setDestinationProvince] = useState<Province | "">("");
  const [destinationAirportCode, setDestinationAirportCode] = useState<string>("");
  const [shipperName, setShipperName] = useState("");
  const [consigneeName, setConsigneeName] = useState("");
  const [pieces, setPieces] = useState<PieceInput[]>([emptyPiece()]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  const weightSummary = useMemo(() => {
    const valid = pieces.filter((p) => p.quantity > 0 && p.lengthCm > 0 && p.widthCm > 0 && p.heightCm > 0 && p.grossWeightKg > 0);
    return summarizeChargeableWeight(valid);
  }, [pieces]);

  function updatePiece(index: number, patch: Partial<PieceInput>) {
    setPieces((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPieceRow() {
    setPieces((prev) => [...prev, emptyPiece()]);
  }

  function removePieceRow(index: number) {
    setPieces((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function resetForm() {
    setMode("ROAD");
    setDestinationScope("NACIONAL");
    setOriginProvince("LUANDA");
    setDestinationProvince("");
    setDestinationAirportCode("");
    setShipperName("");
    setConsigneeName("");
    setPieces([emptyPiece()]);
    setError(null);
    setResult(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!shipperName.trim() || !consigneeName.trim()) {
      setError("Indique o expedidor e o consignatário.");
      return;
    }
    if (mode === "ROAD" && (!destinationProvince || destinationProvince === originProvince)) {
      setError("Escolha uma província de destino diferente da origem.");
      return;
    }
    if (mode === "AIR" && !destinationAirportCode) {
      setError("Escolha o destino do voo.");
      return;
    }
    const validPieces = pieces.filter(
      (p) => p.quantity > 0 && p.lengthCm > 0 && p.widthCm > 0 && p.heightCm > 0 && p.grossWeightKg > 0
    );
    if (validPieces.length === 0) {
      setError("Adicione pelo menos um volume com quantidade, dimensões e peso válidos.");
      return;
    }

    const now = new Date();
    const shipmentNumber = generateShipmentNumber(mode, now);

    let awb: string | undefined;
    let guia: string | undefined;
    let shipment: Shipment;

    if (mode === "AIR") {
      awb = formatAwbNumber("649", Math.floor(Math.random() * 9_000_000) + 1);
      shipment = {
        id: `created-${now.getTime()}`,
        shipmentNumber,
        mode,
        status: "BOOKED",
        shipperName: shipperName.trim(),
        consigneeName: consigneeName.trim(),
        originAirportCode: "LAD",
        destinationAirportCode,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    } else {
      guia = generateRoadGuideNumber(originProvince, destinationProvince as Province, now);
      shipment = {
        id: `created-${now.getTime()}`,
        shipmentNumber,
        mode,
        status: "BOOKED",
        shipperName: shipperName.trim(),
        consigneeName: consigneeName.trim(),
        originProvince,
        destinationProvince: destinationProvince as Province,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    }

    addShipment(shipment);
    setResult({ shipment, awb, guia });
  }

  if (result) {
    const { shipment, awb, guia } = result;
    return (
      <div className="animate-fade-up mx-auto max-w-2xl">
        <Card>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CircleCheck className="h-10 w-10 text-[var(--color-status-good)]" />
            <h1 className="text-lg font-semibold">Expedição emitida com sucesso</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Já está visível no Dashboard Multimodal — nenhuma acção adicional necessária.
            </p>
          </div>

          <div className="mt-4 space-y-3 rounded-lg border border-[var(--color-grid)] bg-[var(--color-page)] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">Nº de Envio</span>
              <span className="font-mono font-semibold">{shipment.shipmentNumber}</span>
            </div>
            {awb && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Air Waybill (AWB)</span>
                <span className="font-mono font-semibold">{awb}</span>
              </div>
            )}
            {guia && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Guia de Transporte Rodoviário</span>
                <span className="font-mono font-semibold">{guia}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">Expedidor → Consignatário</span>
              <span className="font-medium">
                {shipment.shipperName} → {shipment.consigneeName}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">Peso Taxável</span>
              <span className="tabular font-medium">{weightSummary.chargeableWeightKg} kg</span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md bg-[var(--color-series-1)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Nova expedição
            </button>
            <Link
              to="/"
              className="rounded-md border border-[var(--color-grid)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-page)]"
            >
              Ver no Dashboard
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Nova Expedição Multimodal</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Crie uma expedição Aérea ou Terrestre — nacional ou internacional — e emita o documento de transporte.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="1. Modo de Transporte">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("ROAD")}
              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium ${
                mode === "ROAD"
                  ? "border-[var(--color-series-2)] bg-[var(--color-series-2)]/10 text-[var(--color-series-2)]"
                  : "border-[var(--color-grid)] text-[var(--color-text-secondary)]"
              }`}
            >
              <Truck className="h-4 w-4" /> Terrestre (interprovincial)
            </button>
            <button
              type="button"
              onClick={() => setMode("AIR")}
              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium ${
                mode === "AIR"
                  ? "border-[var(--color-series-1)] bg-[var(--color-series-1)]/10 text-[var(--color-series-1)]"
                  : "border-[var(--color-grid)] text-[var(--color-text-secondary)]"
              }`}
            >
              <Plane className="h-4 w-4" /> Aéreo (AWB)
            </button>
          </div>
        </Card>

        <Card title="2. Origem e Destino">
          {mode === "ROAD" ? (
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-[var(--color-text-secondary)]">Província de Origem</span>
                <select
                  value={originProvince}
                  onChange={(e) => setOriginProvince(e.target.value as Province)}
                  className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-2 text-sm"
                >
                  {ALL_PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {PROVINCE_NAME_PT[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-[var(--color-text-secondary)]">Província de Destino</span>
                <select
                  value={destinationProvince}
                  onChange={(e) => setDestinationProvince(e.target.value as Province)}
                  className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-2 text-sm"
                >
                  <option value="">Selecione…</option>
                  {ALL_PROVINCES.filter((p) => p !== originProvince).map((p) => (
                    <option key={p} value={p}>
                      {PROVINCE_NAME_PT[p]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-[var(--color-grid)] bg-[var(--color-page)] px-3 py-2 text-sm">
                <span className="text-[var(--color-text-muted)]">Origem (hub de carga aérea)</span>
                <span className="font-mono font-semibold">Luanda — LAD</span>
              </div>

              <div className="flex gap-1 rounded-lg bg-[var(--color-page)] p-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setDestinationScope("NACIONAL");
                    setDestinationAirportCode("");
                  }}
                  className={`flex-1 rounded-md px-3 py-1.5 font-medium ${
                    destinationScope === "NACIONAL" ? "bg-[var(--color-surface-1)] shadow-sm" : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  Nacional
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDestinationScope("INTERNACIONAL");
                    setDestinationAirportCode("");
                  }}
                  className={`flex-1 rounded-md px-3 py-1.5 font-medium ${
                    destinationScope === "INTERNACIONAL" ? "bg-[var(--color-surface-1)] shadow-sm" : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  Internacional
                </button>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-[var(--color-text-secondary)]">Destino do Voo</span>
                <select
                  value={destinationAirportCode}
                  onChange={(e) => setDestinationAirportCode(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-2 text-sm"
                >
                  <option value="">Selecione…</option>
                  {destinationScope === "NACIONAL"
                    ? DOMESTIC_AIR_DESTINATIONS.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.city} ({d.code}) — {PROVINCE_NAME_PT[d.province]}
                        </option>
                      ))
                    : INTERNATIONAL_DESTINATIONS.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.city} ({d.code}) — {d.country}
                        </option>
                      ))}
                </select>
              </label>
            </div>
          )}
        </Card>

        <Card title="3. Expedidor e Consignatário">
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--color-text-secondary)]">Expedidor</span>
              <input
                value={shipperName}
                onChange={(e) => setShipperName(e.target.value)}
                placeholder="Ex.: Sonangol Distribuição"
                className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--color-text-secondary)]">Consignatário</span>
              <input
                value={consigneeName}
                onChange={(e) => setConsigneeName(e.target.value)}
                placeholder="Ex.: Distribuidora do Huambo"
                className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-2 text-sm"
              />
            </label>
          </div>
        </Card>

        <Card
          title="4. Volumes"
          subtitle="Peso taxável calculado automaticamente (convenção IATA: C×L×A/6000, maior entre bruto e volumétrico)"
        >
          <div className="space-y-3">
            {pieces.map((piece, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] items-end gap-2">
                <label className="text-xs">
                  <span className="mb-1 block text-[var(--color-text-muted)]">Qtd.</span>
                  <input
                    type="number"
                    min={0}
                    value={piece.quantity}
                    onChange={(e) => updatePiece(i, { quantity: Number(e.target.value) })}
                    className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-[var(--color-text-muted)]">Compr. (cm)</span>
                  <input
                    type="number"
                    min={0}
                    value={piece.lengthCm || ""}
                    onChange={(e) => updatePiece(i, { lengthCm: Number(e.target.value) })}
                    className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-[var(--color-text-muted)]">Larg. (cm)</span>
                  <input
                    type="number"
                    min={0}
                    value={piece.widthCm || ""}
                    onChange={(e) => updatePiece(i, { widthCm: Number(e.target.value) })}
                    className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-[var(--color-text-muted)]">Alt. (cm)</span>
                  <input
                    type="number"
                    min={0}
                    value={piece.heightCm || ""}
                    onChange={(e) => updatePiece(i, { heightCm: Number(e.target.value) })}
                    className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-[var(--color-text-muted)]">Peso (kg)</span>
                  <input
                    type="number"
                    min={0}
                    value={piece.grossWeightKg || ""}
                    onChange={(e) => updatePiece(i, { grossWeightKg: Number(e.target.value) })}
                    className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removePieceRow(i)}
                  disabled={pieces.length === 1}
                  className="rounded-md border border-[var(--color-grid)] p-2 text-[var(--color-text-muted)] hover:text-[var(--color-status-critical)] disabled:opacity-30"
                  aria-label="Remover volume"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addPieceRow}
              className="flex items-center gap-1.5 rounded-md border border-dashed border-[var(--color-grid)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-series-1)] hover:text-[var(--color-series-1)]"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Volume
            </button>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-3">
            <StatTile label="Volumes" countTo={weightSummary.pieces} />
            <StatTile label="Peso Bruto" countTo={Math.round(weightSummary.grossWeightKg)} suffix=" kg" />
            <StatTile label="Peso Volumétrico" countTo={Math.round(weightSummary.volumetricWeightKg)} suffix=" kg" />
            <StatTile label="Peso Taxável" countTo={weightSummary.chargeableWeightKg} suffix=" kg" tone="good" />
          </div>
        </Card>

        {error && (
          <div className="rounded-lg border border-[var(--color-status-critical)]/30 bg-[var(--color-status-critical)]/10 px-4 py-3 text-sm text-[var(--color-status-critical)]">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-md bg-[var(--color-series-1)] px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Emitir Expedição
        </button>
      </form>
    </div>
  );
}
