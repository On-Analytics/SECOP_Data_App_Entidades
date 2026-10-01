@AGENTS.md

# SECOP Data App — Entidades (transparency)

Journalist/investigator-facing DataApp: one page + scoped chat per government
buyer entity, built on top of the `secop-colombia-prod` MCP server. This is
the first of two planned DataApp products (the other is supplier/competitive-
intel-facing, not started yet). Full design history and decisions live in
this machine's Claude memory — read `dataapps-transparency-concept.md` and
`dataapps-entity-concept.md` there before assuming anything below is stale.

## Current state (as of 2026-09-30)

- **Scaffolded:** Next.js (TypeScript, Tailwind, App Router). No pages built
  yet — only the data-refresh side exists so far.
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
  **Not yet run end-to-end** — needs a human to complete the browser login.
- **Deliberately deferred:** the "contract growth after signing"
  (`modificaciones_de_contrato`) signal — needs enumerating contract ids per
  entity first, heavier, phase 2.
- **Not started:** the actual page UI, the chat (model: `openai:gpt-6-luna`,
  built model-agnostic so it can be swapped later), the snapshot database
  (currently just local JSON files), and automating the refresh (currently
  manual-only; WorkOS AuthKit has no headless/M2M path wired up yet).

## Next steps, roughly in order

1. Run `npm run refresh` (copy `.env.example` → `.env` first) and confirm it
   actually pulls data — this hasn't been verified live yet.
2. Decide the snapshot-store DB (Vercel Postgres / Neon / Supabase — not
   chosen yet) and move off local JSON files.
3. Build one entity page (pick one, e.g. JEP) reading from a snapshot to
   validate the page-content plan in memory before templating all 9.
4. Wire up the chat (Luna), scoped per entity.
