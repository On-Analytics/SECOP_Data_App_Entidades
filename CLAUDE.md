@AGENTS.md

# SECOP Data App — Entidades (transparency)

Journalist/investigator-facing DataApp: one page + scoped chat per government
buyer entity, built on top of the `secop-colombia-prod` MCP server. This is
the first of two planned DataApp products (the other is supplier/competitive-
intel-facing, not started yet). Full design history and decisions live in
this machine's Claude memory — read `dataapps-transparency-concept.md` and
`dataapps-entity-concept.md` there before assuming anything below is stale.

## Current state (as of 2026-09-30)

- **Scaffolded:** Next.js (TypeScript, Tailwind, App Router). Pushed to
  github.com/On-Analytics/SECOP_Data_App_Entidades (`main`).
- **Entity page built:** `app/entidad/[nit]/page.tsx` (static, one per entity
  in `data/entidades.json`) reads `data/snapshots/<nit>.json` via
  `lib/snapshot.ts`. All 9 snapshots exist locally (gitignored), pulled
  2026-09-30 by Claude through its own secop-colombia-prod MCP connection
  with the same calls/args as the script — a stopgap until the script's
  login works. Metroparques and Empoaguas have 0 signed contracts in the data.
- **MCP data issues the page works around (worth fixing server-side):**
  `sancionado_reincidente` joins on placeholder documents ("0", "1") and
  includes a test entity ("Z ENTIDAD DE PRUEBA"); `perfil_entidad` totals
  include additions the server itself flags as capture errors (AMVA's total
  is ~65% one bad contract).
- **Entities (9 confirmed, in `data/entidades.json`):** JEP, Unidad para las
  Víctimas, Área Metropolitana del Valle de Aburrá, Parque de las Aguas
  (Metroparques), Municipio de Puerto Gaitán, Aerocivil, Empoaguas E.S.P.,
  Superintendencia de la Economía Solidaria, Fondo Rotatorio de la Policía
  Nacional. Five more names are set aside unresolved (Kluster Latam, FENOGE,
  CIPPA, Fondo Mixto Sierra Nevada, Hospital San Vicente de Paúl) — see the
  transparency memory for why.
- **Refresh script (`npm run refresh`, i.e. `scripts/refresh.ts`):** logs in
  interactively via WorkOS AuthKit in a browser (token cached in
  `.mcp-auth.json`, gitignored), then for each entity calls `perfil_entidad`,
  `detectar_anomalias` (`detector: "todos"`), and `procesos_abiertos`
  against `MCP_URL`, writing one JSON file per entity to `data/snapshots/`.
  **Blocked:** the AuthKit server has no dynamic client registration, so the
  login fails before the browser opens. It does accept URL-based client ids
  (Client ID Metadata Documents): host `client-metadata.json` at a public
  HTTPS URL (its `client_id` must equal that URL) and set
  `MCP_CLIENT_METADATA_URL` — or enable DCR in the WorkOS dashboard.
- **Deliberately deferred:** the "contract growth after signing"
  (`modificaciones_de_contrato`) signal — needs enumerating contract ids per
  entity first, heavier, phase 2.
- **Not started:** the actual page UI, the chat (model: `openai:gpt-6-luna`,
  built model-agnostic so it can be swapped later), the snapshot database
  (currently just local JSON files), and automating the refresh (currently
  manual-only; WorkOS AuthKit has no headless/M2M path wired up yet).

## Next steps, roughly in order

1. Unblock `npm run refresh` (see Blocked above), then run it to fill all 9
   snapshots.
2. Decide the snapshot-store DB (Vercel Postgres / Neon / Supabase — not
   chosen yet) and move off local JSON files.
3. Fill page gaps vs. the memory plan: 12-month vs. prior-12 headline,
   modalidad mix over time, seasonality (need `serie_temporal` in the
   snapshot), and contract growth (`modificaciones_de_contrato`).
4. Wire up the chat (Luna), scoped per entity.
