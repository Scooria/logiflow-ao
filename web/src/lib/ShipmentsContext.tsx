/**
 * Estado partilhado de envios — combina os dados vindos da API/mock
 * (fetchShipments) com expedições criadas nesta sessão através do ecrã
 * "Nova Expedição", para que uma reserva recém-criada apareça de imediato
 * no Dashboard sem precisar de um backend real a persistir o registo.
 */
import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shipment } from "../types/domain";
import { fetchShipments } from "./api";

interface ShipmentsContextValue {
  shipments: Shipment[];
  isLoading: boolean;
  addShipment: (shipment: Shipment) => void;
}

const ShipmentsContext = createContext<ShipmentsContextValue | null>(null);

export function ShipmentsProvider({ children }: { children: ReactNode }) {
  const query = useQuery({ queryKey: ["shipments"], queryFn: () => fetchShipments() });
  const [createdShipments, setCreatedShipments] = useState<Shipment[]>([]);

  const shipments = useMemo(
    () => [...createdShipments, ...(query.data ?? [])],
    [createdShipments, query.data]
  );

  function addShipment(shipment: Shipment) {
    setCreatedShipments((prev) => [shipment, ...prev]);
  }

  return (
    <ShipmentsContext.Provider value={{ shipments, isLoading: query.isLoading, addShipment }}>
      {children}
    </ShipmentsContext.Provider>
  );
}

export function useShipments(): ShipmentsContextValue {
  const ctx = useContext(ShipmentsContext);
  if (!ctx) throw new Error("useShipments() deve ser usado dentro de <ShipmentsProvider>.");
  return ctx;
}
