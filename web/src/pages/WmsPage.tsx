import { useQuery } from "@tanstack/react-query";
import { fetchWarehouseMap } from "../lib/api";
import { WarehouseMap } from "../components/wms/WarehouseMap";

export default function WmsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["warehouse", "wh1"],
    queryFn: () => fetchWarehouseMap("wh1"),
  });

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Painel de Gestão WMS</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Mapa visual de armazém — clique numa posição para ver o stock alocado em tempo real.
      </p>

      {isLoading && <p className="text-sm text-[var(--color-text-muted)]">A carregar mapa do armazém…</p>}
      {error && <p className="text-sm text-[var(--color-status-critical)]">Não foi possível carregar o armazém.</p>}
      {data && <WarehouseMap warehouse={data} />}
    </div>
  );
}
