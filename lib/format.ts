const entero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 });

/**
 * Colombian-press style peso amounts: "$1,94 billones", "$377.040 millones".
 * (Un billón = 10^12, the Spanish long scale.)
 */
export function pesos(valor: number | undefined | null): string {
  if (valor == null) return "—";
  if (Math.abs(valor) >= 1e12) return `$${decimal.format(valor / 1e12)} billones`;
  if (Math.abs(valor) >= 1e6) return `$${entero.format(valor / 1e6)} millones`;
  return `$${entero.format(valor)}`;
}

export function numero(valor: number | undefined | null): string {
  return valor == null ? "—" : entero.format(valor);
}

export function porcentaje(fraccion: number): string {
  return pct.format(fraccion);
}

/** "2026-09-30 08:44" or an ISO string → "30 sep 2026". */
export function fecha(valor: string | undefined | null): string {
  if (!valor) return "—";
  const d = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/** Strips the markdown bold the MCP server puts in its notes. */
export function sinMarkdown(texto: string): string {
  return texto.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}
