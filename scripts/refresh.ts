/**
 * Manual nightly-snapshot-equivalent refresh, run by hand for now:
 *   npm run refresh
 *
 * Logs in interactively via WorkOS AuthKit (browser opens once; the token is
 * cached in .mcp-auth.json for later runs), then pulls each entity's
 * accountability snapshot from the SECOP MCP server and writes it to
 * data/snapshots/<nit>.json. See memory dataapps-transparency-concept.md
 * for why this is manual-first and what the OR-30-day window covers when
 * this becomes an automated job later.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { connectToSecopMcp } from "../lib/mcp-client.js";

const MCP_URL = process.env.MCP_URL;
if (!MCP_URL) {
  console.error("MCP_URL is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

// Display window decided 2026-09-30: cumulative from 2018, not a rolling
// 12-month window (needed for seasonality / concentration / "last year"
// questions to mean anything).
const DESDE = "2018-01-01";

interface Entidad {
  nombre: string;
  nit: string;
}

interface Snapshot {
  entidad: Entidad;
  generado_en: string;
  desde: string;
  perfil: unknown;
  anomalias: unknown;
  procesos_abiertos: unknown;
  errores: string[];
}

const entidadesPath = join(process.cwd(), "data", "entidades.json");
const entidades: Entidad[] = JSON.parse(readFileSync(entidadesPath, "utf-8"));

const snapshotsDir = join(process.cwd(), "data", "snapshots");
mkdirSync(snapshotsDir, { recursive: true });

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.request(
    { method: "tools/call", params: { name, arguments: args } },
    CallToolResultSchema,
  );
  const textContent = result.content?.find((c) => c.type === "text");
  // Tool-level failures come back as a normal result flagged isError, not a
  // thrown exception — surface them so they land in `errores`, not as data.
  if (result.isError) {
    throw new Error(textContent?.text ?? "tool returned isError with no message");
  }
  if (!textContent) return result;
  try {
    return JSON.parse(textContent.text);
  } catch {
    return textContent.text;
  }
}

async function main() {
  console.log(`Connecting to ${MCP_URL} ...`);
  const client = await connectToSecopMcp(MCP_URL!);
  console.log("Connected.\n");

  for (const entidad of entidades) {
    console.log(`Refreshing ${entidad.nombre} (NIT ${entidad.nit}) ...`);
    const errores: string[] = [];

    const perfil = await callTool(client, "perfil_entidad", {
      nit_entidad: entidad.nit,
      desde: DESDE,
    }).catch((e) => {
      errores.push(`perfil_entidad: ${e.message}`);
      return null;
    });

    const anomalias = await callTool(client, "detectar_anomalias", {
      detector: "todos",
      nit_entidad: entidad.nit,
      desde: DESDE,
    }).catch((e) => {
      errores.push(`detectar_anomalias: ${e.message}`);
      return null;
    });

    const procesosAbiertos = await callTool(client, "procesos_abiertos", {
      nit_entidad: entidad.nit,
    }).catch((e) => {
      errores.push(`procesos_abiertos: ${e.message}`);
      return null;
    });

    const snapshot: Snapshot = {
      entidad,
      generado_en: new Date().toISOString(),
      desde: DESDE,
      perfil,
      anomalias,
      procesos_abiertos: procesosAbiertos,
      errores,
    };

    const outPath = join(snapshotsDir, `${entidad.nit}.json`);
    writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf-8");
    console.log(`  -> ${outPath}${errores.length ? ` (${errores.length} error(es), see file)` : ""}`);
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Refresh failed:", err);
  process.exit(1);
});
