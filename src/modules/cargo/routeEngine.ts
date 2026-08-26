/**
 * Motor de cálculo de rotas interprovinciais (Angola, 21 províncias) e
 * corredores SADC (ex.: Corredor do Lobito).
 *
 * Estratégia em duas camadas:
 *   1. TENANT_ROUTES — grafo construído a partir dos `RoadRoute` que o
 *      próprio tenant configurou (dados operacionais reais, com distância e
 *      tempo validados pela sua equipa de operações).
 *   2. SEED_ESTIMATE — se não existir caminho no grafo do tenant entre a
 *      origem e o destino, e `ALLOW_SEED_ROUTE_FALLBACK` estiver activo,
 *      recorre-se ao grafo de adjacência aproximado (ver config/provinces.ts)
 *      para produzir uma ESTIMATIVA, claramente sinalizada como tal.
 *
 * Algoritmo: Dijkstra clássico sobre grafo não-direccionado ponderado por
 * distância (km); o tempo estimado é somado em paralelo ao longo do caminho.
 */
import { Province } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../lib/env";
import { ValidationError } from "../../lib/errors";
import { SEED_PROVINCE_ADJACENCY, ALL_PROVINCES } from "../../config/provinces";

export type RouteSource = "TENANT_ROUTES" | "SEED_ESTIMATE";

export interface RouteHop {
  from: Province;
  to: Province;
  distanceKm: number;
  estimatedHours: number;
  isSadcCorridor: boolean;
  roadRouteId?: string; // presente apenas quando o troço vem de um RoadRoute real do tenant
}

export interface RouteResult {
  origin: Province;
  destination: Province;
  totalDistanceKm: number;
  totalEstimatedHours: number;
  isSadcCorridor: boolean; // true se QUALQUER troço do caminho atravessar o corredor
  source: RouteSource;
  hops: RouteHop[];
}

interface Graph {
  [province: string]: RouteHop[];
}

function addEdge(graph: Graph, hop: RouteHop): void {
  (graph[hop.from] ??= []).push(hop);
  (graph[hop.to] ??= []).push({
    from: hop.to,
    to: hop.from,
    distanceKm: hop.distanceKm,
    estimatedHours: hop.estimatedHours,
    isSadcCorridor: hop.isSadcCorridor,
    roadRouteId: hop.roadRouteId,
  });
}

function buildSeedGraph(): Graph {
  const graph: Graph = {};
  for (const edge of SEED_PROVINCE_ADJACENCY) {
    addEdge(graph, {
      from: edge.from,
      to: edge.to,
      distanceKm: edge.distanceKm,
      estimatedHours: edge.estimatedHours,
      isSadcCorridor: Boolean(edge.isSadcCorridor),
    });
  }
  return graph;
}

async function buildTenantGraph(tenantId: string): Promise<Graph> {
  const routes = await prisma.roadRoute.findMany({
    where: { tenantId, isActive: true },
  });

  const graph: Graph = {};
  for (const route of routes) {
    if (route.distanceKm == null) continue; // ignora rotas sem distância definida
    addEdge(graph, {
      from: route.originProvince,
      to: route.destinationProvince,
      distanceKm: Number(route.distanceKm),
      estimatedHours: route.estimatedHours ? Number(route.estimatedHours) : 0,
      isSadcCorridor: route.isSadcCorridor,
      roadRouteId: route.id,
    });
  }
  return graph;
}

/** Dijkstra sobre o grafo fornecido; devolve null se não houver caminho. */
function shortestPath(
  graph: Graph,
  origin: Province,
  destination: Province
): RouteHop[] | null {
  const distances = new Map<Province, number>();
  const previous = new Map<Province, RouteHop>();
  const visited = new Set<Province>();
  const queue = new Set<Province>(ALL_PROVINCES);

  for (const p of ALL_PROVINCES) distances.set(p, Infinity);
  distances.set(origin, 0);

  while (queue.size > 0) {
    let current: Province | null = null;
    let currentDist = Infinity;
    for (const p of queue) {
      const d = distances.get(p) ?? Infinity;
      if (d < currentDist) {
        currentDist = d;
        current = p;
      }
    }

    if (current === null || currentDist === Infinity) break;
    queue.delete(current);
    visited.add(current);

    if (current === destination) break;

    for (const hop of graph[current] ?? []) {
      if (visited.has(hop.to)) continue;
      const candidate = currentDist + hop.distanceKm;
      if (candidate < (distances.get(hop.to) ?? Infinity)) {
        distances.set(hop.to, candidate);
        previous.set(hop.to, hop);
      }
    }
  }

  if (!previous.has(destination) && origin !== destination) return null;

  const path: RouteHop[] = [];
  let node = destination;
  while (node !== origin) {
    const hop = previous.get(node);
    if (!hop) return null;
    path.unshift(hop);
    node = hop.from;
  }
  return path;
}

function summarizePath(
  origin: Province,
  destination: Province,
  path: RouteHop[],
  source: RouteSource
): RouteResult {
  return {
    origin,
    destination,
    totalDistanceKm: Number(path.reduce((s, h) => s + h.distanceKm, 0).toFixed(1)),
    totalEstimatedHours: Number(path.reduce((s, h) => s + h.estimatedHours, 0).toFixed(1)),
    isSadcCorridor: path.some((h) => h.isSadcCorridor),
    source,
    hops: path,
  };
}

/**
 * Calcula a melhor rota interprovincial entre origem e destino para o
 * tenant indicado. Tenta primeiro os `RoadRoute` reais do tenant; só recorre
 * ao grafo de referência (estimativa) se não existir caminho configurado e
 * `ALLOW_SEED_ROUTE_FALLBACK` estiver activo.
 */
export async function findRoute(
  tenantId: string,
  origin: Province,
  destination: Province
): Promise<RouteResult> {
  if (origin === destination) {
    return {
      origin,
      destination,
      totalDistanceKm: 0,
      totalEstimatedHours: 0,
      isSadcCorridor: false,
      source: "TENANT_ROUTES",
      hops: [],
    };
  }

  const tenantGraph = await buildTenantGraph(tenantId);
  const tenantPath = shortestPath(tenantGraph, origin, destination);
  if (tenantPath) {
    return summarizePath(origin, destination, tenantPath, "TENANT_ROUTES");
  }

  if (!env.ALLOW_SEED_ROUTE_FALLBACK) {
    throw new ValidationError(
      `Não existe rota configurada entre ${origin} e ${destination}, e o fallback de estimativa está desactivado. Configure um RoadRoute para este trajecto.`
    );
  }

  const seedGraph = buildSeedGraph();
  const seedPath = shortestPath(seedGraph, origin, destination);
  if (!seedPath) {
    throw new ValidationError(`Não foi possível calcular uma rota entre ${origin} e ${destination}.`);
  }

  return summarizePath(origin, destination, seedPath, "SEED_ESTIMATE");
}
