# CLAUDE.md — Geo Pixel Board

You are the main coding worker for this project.

Read `project_plan_draft.md` (feature spec) and `WORKPLAN.md` (build order) before
making code changes. Work only within the requested Phase / build stage.

## Hard rules

- Use Svelte 5 runes only: `$state`, `$derived`, `$effect`, `$props`.
- Do not use Svelte 3/4 syntax: `export let`, `$:`, store auto-subscription in component scripts.
- Render the pixel board with one `<canvas>`. Never create one DOM element per pixel.
- Keep map rendering and board rendering imperative; let Svelte own UI state and controls.
- Store no raw user coordinates. Use coordinates only for the write-permission check, then discard.
- Do not log raw `lat`/`lng`. Debug logs may keep distance/accuracy buckets only.
- Shared protocol/types live in `shared/` and are used by both client and worker.
- The server-side Durable Object enforces the location gate and cooldown. Client-side
  disabled buttons are UX only.
- Implement only the current Phase. Do not build v2 features early (reports, R2 thumbnails,
  account systems, owner claims, etc.).
- Per the project owner: keep automated tests minimal. Prefer `pnpm check` (types) plus
  manual `wrangler dev` / two-browser smoke testing over writing test suites.
- After work, append a short entry to `history.md`.

## Default commands

- `pnpm install`
- `pnpm check` — svelte-check + tsc type checking (primary quality gate)
- `pnpm dev` — Vite + Cloudflare plugin (client HMR + Worker + DO + local D1)
- `pnpm db:migrate:local` — apply D1 migrations locally
- `pnpm db:seed:local` — seed demo rooms
- `pnpm build` / `pnpm deploy`

## Architecture quick reference

- `shared/` — pure TS: constants, palette, geohash, haversine, location gate, snapshot codec, Zod protocol.
- `worker/` — Hono app (`/api/*`, `/ws/:roomId`) + `RoomDurableObject` (WebSocket hibernation, pixel SQLite).
- `client/` — Svelte 5 SPA: MapLibre map + imperative canvas board + room WebSocket.
- D1 holds the global room index (pins only). Each room's pixels live in that room's DO SQLite.

## Common mistakes to avoid

- Svelte 3/4 syntax instead of runes.
- A DOM grid instead of one canvas.
- `console.log(lat, lng)`.
- Enforcing cooldown/gate only on the client and skipping server validation.
- Validating location only on `join` and not re-validating on `paint`.
- Storing pixel data in D1.
- Dropping the map tile attribution.
