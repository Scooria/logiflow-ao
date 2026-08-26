/**
 * Configuração das 21 províncias de Angola.
 *
 * `code` é o prefixo de 3 letras usado no endereçamento único WMS
 * (ex.: AO-LUA-WH1-ZA-R04-L02-B12) e nos números de guia rodoviária.
 *
 * `SEED_PROVINCE_ADJACENCY` é um grafo de ADJACÊNCIA GEOGRÁFICA aproximado
 * (fronteiras reais entre províncias) com distância/tempo de referência,
 * usado apenas como ESTIMATIVA de fallback pelo motor de rotas quando o
 * tenant ainda não configurou os seus próprios `RoadRoute` (ver Passo 1).
 * Os valores de distância/tempo são arredondados e indicativos — não
 * substituem uma matriz validada (ex.: levantamento em campo, INEA, ou
 * serviço de routing licenciado) antes de uso em produção.
 */
import { Province } from "@prisma/client";

export const PROVINCE_CODE: Record<Province, string> = {
  LUANDA: "LUA",
  BENGO: "BGO",
  BENGUELA: "BGU",
  BIE: "BIE",
  CABINDA: "CAB",
  CUANDO_CUBANGO: "CCB",
  CUANZA_NORTE: "CNO",
  CUANZA_SUL: "CSU",
  CUNENE: "CUN",
  HUAMBO: "HUA",
  HUILA: "HUI",
  LUNDA_NORTE: "LNO",
  LUNDA_SUL: "LSU",
  MALANJE: "MAL",
  MOXICO: "MOX",
  NAMIBE: "NAM",
  UIGE: "UIG",
  ZAIRE: "ZAI",
  ICOLO_E_BENGO: "ICB",
  MOXICO_LESTE: "MXL",
  CUANDO: "CDO",
};

export const PROVINCE_NAME_PT: Record<Province, string> = {
  LUANDA: "Luanda",
  BENGO: "Bengo",
  BENGUELA: "Benguela",
  BIE: "Bié",
  CABINDA: "Cabinda",
  CUANDO_CUBANGO: "Cuando Cubango",
  CUANZA_NORTE: "Cuanza Norte",
  CUANZA_SUL: "Cuanza Sul",
  CUNENE: "Cunene",
  HUAMBO: "Huambo",
  HUILA: "Huíla",
  LUNDA_NORTE: "Lunda Norte",
  LUNDA_SUL: "Lunda Sul",
  MALANJE: "Malanje",
  MOXICO: "Moxico",
  NAMIBE: "Namibe",
  UIGE: "Uíge",
  ZAIRE: "Zaire",
  ICOLO_E_BENGO: "Icolo e Bengo",
  MOXICO_LESTE: "Moxico Leste",
  CUANDO: "Cuando",
};

export interface SeedEdge {
  from: Province;
  to: Province;
  distanceKm: number;
  estimatedHours: number;
  /** Troço faz parte do Corredor do Lobito (Lobito–Benguela–Huambo–Bié–Moxico / ligação SADC). */
  isSadcCorridor?: boolean;
}

/**
 * Grafo não-direccionado de adjacência interprovincial (referência/demo).
 * Cabinda liga-se ao resto do território por corredor marítimo/terrestre
 * via RDC — modelado como uma aresta de maior custo relativo.
 */
export const SEED_PROVINCE_ADJACENCY: SeedEdge[] = [
  { from: "ZAIRE", to: "CABINDA", distanceKm: 460, estimatedHours: 9 },
  { from: "ZAIRE", to: "UIGE", distanceKm: 300, estimatedHours: 6 },
  { from: "ZAIRE", to: "BENGO", distanceKm: 260, estimatedHours: 5 },
  { from: "UIGE", to: "BENGO", distanceKm: 280, estimatedHours: 5.5 },
  { from: "UIGE", to: "CUANZA_NORTE", distanceKm: 230, estimatedHours: 4.5 },
  { from: "UIGE", to: "MALANJE", distanceKm: 260, estimatedHours: 5 },
  { from: "BENGO", to: "LUANDA", distanceKm: 60, estimatedHours: 1 },
  { from: "BENGO", to: "ICOLO_E_BENGO", distanceKm: 70, estimatedHours: 1.5 },
  { from: "BENGO", to: "CUANZA_NORTE", distanceKm: 150, estimatedHours: 3 },
  { from: "LUANDA", to: "ICOLO_E_BENGO", distanceKm: 45, estimatedHours: 1 },
  { from: "ICOLO_E_BENGO", to: "CUANZA_SUL", distanceKm: 190, estimatedHours: 3.5 },
  { from: "ICOLO_E_BENGO", to: "MALANJE", distanceKm: 300, estimatedHours: 5.5 },
  { from: "CUANZA_NORTE", to: "MALANJE", distanceKm: 170, estimatedHours: 3 },
  { from: "CUANZA_NORTE", to: "CUANZA_SUL", distanceKm: 210, estimatedHours: 4 },
  { from: "MALANJE", to: "LUNDA_NORTE", distanceKm: 420, estimatedHours: 7.5 },
  { from: "MALANJE", to: "CUANZA_SUL", distanceKm: 260, estimatedHours: 5 },
  { from: "MALANJE", to: "BIE", distanceKm: 380, estimatedHours: 7, isSadcCorridor: true },
  { from: "LUNDA_NORTE", to: "LUNDA_SUL", distanceKm: 260, estimatedHours: 5 },
  { from: "LUNDA_SUL", to: "MOXICO", distanceKm: 340, estimatedHours: 6.5, isSadcCorridor: true },
  { from: "CUANZA_SUL", to: "BENGUELA", distanceKm: 210, estimatedHours: 4, isSadcCorridor: true },
  { from: "CUANZA_SUL", to: "HUAMBO", distanceKm: 230, estimatedHours: 4.5, isSadcCorridor: true },
  { from: "CUANZA_SUL", to: "BIE", distanceKm: 300, estimatedHours: 5.5, isSadcCorridor: true },
  { from: "BENGUELA", to: "HUAMBO", distanceKm: 210, estimatedHours: 4, isSadcCorridor: true }, // Corredor do Lobito
  { from: "BENGUELA", to: "NAMIBE", distanceKm: 330, estimatedHours: 6 },
  { from: "BENGUELA", to: "HUILA", distanceKm: 380, estimatedHours: 7 },
  { from: "HUAMBO", to: "BIE", distanceKm: 200, estimatedHours: 3.5, isSadcCorridor: true }, // Corredor do Lobito
  { from: "HUAMBO", to: "HUILA", distanceKm: 260, estimatedHours: 5 },
  { from: "BIE", to: "MOXICO", distanceKm: 430, estimatedHours: 8, isSadcCorridor: true }, // Corredor do Lobito -> fronteira SADC
  { from: "BIE", to: "CUANDO_CUBANGO", distanceKm: 400, estimatedHours: 7.5 },
  { from: "MOXICO", to: "MOXICO_LESTE", distanceKm: 260, estimatedHours: 5, isSadcCorridor: true },
  { from: "MOXICO_LESTE", to: "CUANDO", distanceKm: 300, estimatedHours: 6 },
  { from: "MOXICO", to: "CUANDO", distanceKm: 350, estimatedHours: 6.5 },
  { from: "NAMIBE", to: "HUILA", distanceKm: 280, estimatedHours: 5 },
  { from: "HUILA", to: "CUNENE", distanceKm: 220, estimatedHours: 4 },
  { from: "HUILA", to: "CUANDO_CUBANGO", distanceKm: 350, estimatedHours: 6.5 },
  { from: "CUNENE", to: "CUANDO_CUBANGO", distanceKm: 380, estimatedHours: 7 },
  { from: "CUANDO_CUBANGO", to: "CUANDO", distanceKm: 320, estimatedHours: 6 },
];

export const ALL_PROVINCES: Province[] = Object.keys(PROVINCE_CODE) as Province[];
