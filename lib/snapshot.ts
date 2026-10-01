import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Shapes of the snapshot files written by scripts/refresh.ts. Only the
 * fields the page reads are typed; the MCP tools return more. Kept loose
 * (optional fields) on purpose: the MCP server owns these shapes, and a
 * missing field should degrade a section, not crash the page.
 */

export interface Entidad {
  nombre: string;
  nit: string;
}

export interface Proveedor {
  proveedor: string;
  documento_proveedor: string;
  contratos: number;
  valor: number;
  es_consorcio: boolean;
}

export interface Categoria {
  codigo: string;
  /** null for contracts with no valid UNSPSC code ("UNSPEC"). */
  nombre: string | null;
  contratos: number;
  valor: number;
}

export interface Perfil {
  nombre_mas_frecuente?: string;
  departamento?: string;
  orden_administrativo?: string;
  rama?: string;
  /** All but `cantidad` come back null when the entity has no signed contracts. */
  contratos?: {
    cantidad: number;
    valor_total: number | null;
    valor_mediano: number | null;
    proveedores_distintos: number;
    desde: string | null;
    hasta: string | null;
    valor_pagado_total?: number | null;
  };
  principales_proveedores?: Proveedor[];
  principales_categorias?: Categoria[];
  modalidades?: { modalidad: string; contratos: number; valor: number }[];
  estados?: { estado: string; contratos: number; valor: number }[];
  advertencias?: string[];
  datos_al?: string;
}

/** A finding row. Detectors return different columns; these are the union. */
export interface Hallazgo {
  id_proceso?: string;
  id_contrato?: string;
  objeto?: string;
  proveedor?: string;
  documento?: string;
  modalidad?: string;
  url?: string;
  fecha_publicacion?: string;
  fecha_firma?: string;
  presupuesto?: number;
  valor_adjudicado?: number;
  proponentes?: number;
  dias_de_ventana?: number;
  corte_de_su_modalidad?: number;
  valor_base?: number;
  valor_final?: number;
  adicionado?: number;
  proporcion?: number;
  n_modificaciones?: number;
  contratos_posteriores?: number;
  valor_posterior?: number;
  primera_sancion_en_firme?: string;
  sanciones?: number;
  sancionado_por?: string;
  // posible_fraccionamiento
  documento_proveedor?: string;
  categoria?: string;
  contratos?: number;
  valor_conjunto?: number;
  primera_firma?: string;
  ultima_firma?: string;
  dias_entre_extremos?: number;
  probable_error_de_captura?: boolean;
}

export interface ResultadoDetector {
  detector: string;
  que_busca: string;
  total_hallazgos: number;
  hallazgos: Hallazgo[];
  cobertura?: { nota?: string; errores_de_captura?: string } & Record<string, unknown>;
  umbral_aplicado?: Record<string, unknown>;
}

export interface Anomalias {
  resumen?: { detector: string; que_busca: string; total_hallazgos: number }[];
  resultados?: ResultadoDetector[];
  no_aplicables?: { detector: string; motivo?: string }[];
  hallazgos_por_detector?: number;
  advertencias?: string[];
}

export interface ProcesoAbierto {
  id?: string;
  objeto?: string;
  modalidad?: string;
  tipo_contrato?: string;
  presupuesto?: number;
  fecha_publicacion?: string;
  cierre_recepcion?: string;
  url?: string;
}

export interface ProcesosAbiertos {
  total_disponible?: number;
  procesos?: ProcesoAbierto[];
  criterio_de_abierto?: string;
  advertencias?: string[];
}

export interface Snapshot {
  entidad: Entidad;
  generado_en: string;
  desde: string;
  perfil: Perfil | null;
  anomalias: Anomalias | null;
  procesos_abiertos: ProcesosAbiertos | null;
  errores: string[];
}

const DATA_DIR = join(process.cwd(), "data");

export function listEntidades(): Entidad[] {
  return JSON.parse(readFileSync(join(DATA_DIR, "entidades.json"), "utf-8"));
}

/** Returns null when no snapshot has been pulled yet for this NIT. */
export function loadSnapshot(nit: string): Snapshot | null {
  if (!/^\d+$/.test(nit)) return null;
  const path = join(DATA_DIR, "snapshots", `${nit}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}
