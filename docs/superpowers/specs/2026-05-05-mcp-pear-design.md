# mcp-pear v0.1 — Design

**Status:** approved 2026-05-05
**Scope:** read-only MCP server exposing Pear Protocol's API to AI agents
**Audience:** implementation plan author + future contributors

---

## 1. Goal

Build a Model Context Protocol server that lets an LLM (Claude Desktop, ADK-TS agents, etc.) read live data from Pear Protocol — market state, the caller's account, positions, orders, trade history, and portfolio PnL. Read-only in v0.1; trade execution is deferred to v0.2.

The server mirrors IQAIcom's existing MCP servers (mcp-polymarket primarily) in tooling, layout, and conventions so it can later be promoted into the `@iqai` org with minimal churn.

---

## 2. Verified facts about the Pear API

These were confirmed by reading docs.pearprotocol.io and probing the live API on 2026-05-05.

**Base URL:** `https://hl-v2.pearprotocol.io`. (`api.pearprotocol.io` exists as a separate host with a different schema; we do **not** use it.)

**Auth:** `Authorization: Bearer <accessToken>`. mcp-pear supports three auth modes (see §10):

1. **JWT pass-through** — caller mints the JWT externally (e.g. Privy → Pear `/auth/login`), passes it via `PEAR_JWT`. mcp-pear treats it as opaque.
2. **API key + wallet address** — caller provides `PEAR_API_KEY` + `PEAR_ADDRESS`; mcp-pear mints the JWT by calling `POST /auth/login`.
3. **Public-only** — no auth env vars set; only the four public tools work.

The `POST /auth/login` body for mode 2 (per OpenAPI spec, all four fields required at top level):

```json
{
  "method": "api_key",
  "address": "<PEAR_ADDRESS>",
  "clientId": "APITRADER",
  "details": { "apiKey": "<PEAR_API_KEY>" }
}
```

Response: `{ accessToken, refreshToken, tokenType, expiresIn, address, clientId }`. Refresh via `POST /auth/refresh` with `{ refreshToken }` — returns rotated `accessToken` + `refreshToken`.

**Agent wallet** is required only for trade execution (mutating endpoints). All v0.1 reads work with just the JWT.

**Public endpoints** (no auth):
- `GET /health` → `{ status, timestamp, uptime }`
- `GET /markets` (filters: `search`, `engine`, `minVolume`, `change24h`, `netFunding`, `sort`, `excludeText`, `active`, `offset`, `page`, `pageSize`) → `{ markets[], total, page, pageSize, totalPages }`. Each row carries `name` (composition key like `L:BTC,HYPE,ONDO|S:`), `ratio`, `prevRatio`, `change24h`, `weightedRatio`, `weightedPrevRatio`, `weightedChange24h`, `volume`, `openInterest`, `netFunding`.
- `GET /markets/active` → `{ active[], topGainers[], topLosers[], highlighted[], watchlist[] }`. Each item has `key`, `longAssets[{asset, weight}]`, `shortAssets[{asset, weight}]`, plus the same ratio/volume metrics.

**Authenticated read endpoints** (Bearer JWT):
- `GET /accounts` → `{ agentWalletAddress, totalClosedTrades, totalTriggerOrderUsdValue, totalTwapChunkUsdValue, lastSyncedAt }`
- `GET /positions` → array of `{ positionId, entryRatio, markRatio, unrealizedPnl, longAssets[], shortAssets[], ... }`
- `GET /orders/open` → array of `OpenOrderDto`
- `GET /orders/twap` → array of `TwapMonitoringDto` with chunk execution detail
- `GET /trade-history?limit&startDate&endDate` → array of `TradeHistoryDataDto` with realized PnL fields
- `GET /portfolio` → bucketed metrics across `oneDay | oneWeek | oneMonth | oneYear | all` plus an `overall` block (winning/losing trade counts and amounts, volume, open interest, unrealized PnL, total trade count)

**Endpoints that do NOT exist** (despite appearing in the original scope draft): `/market-data/pair-ratio`, `/market-data/candle`, `/market-data/overview`, `/market-data/asset-context`. The entire `/market-data/*` namespace returns 404 on both `hl-v2.pearprotocol.io` and `api.pearprotocol.io`. v0.1 substitutes `list_markets`, `get_active_markets`, and a synthesized `get_pair_ratio` (which filters `/markets`). Candles have no public source and are deferred to v0.2 (potential synthesis from Hyperliquid's `candleSnapshot`).

### Resolved: address-in-login

The OpenAPI spec at `docs.pearprotocol.io/api-integration/api-specification/authentication.md` confirms `address` is required at the top level of the `POST /auth/login` body for all auth methods including `api_key`. mcp-pear sends it from the `PEAR_ADDRESS` env var. The original v0.1 plan flagged this as a known unknown; it was resolved during implementation when the OpenAPI was inspected.

---

## 3. Stack & conventions

Mirrors `IQAIcom/mcp-polymarket` exactly except where noted.

| Concern | Choice |
|---|---|
| MCP wrapper | `fastmcp@^3` |
| Schema validation | `zod@^3` |
| HTTP client | native `fetch` (no axios) |
| Bundler | none — plain `tsc` to `dist/`, then `shx chmod +x dist/index.js` |
| Linter/formatter | Biome (tab indent, double quotes, organize-imports on) |
| Test runner | Vitest |
| Package manager | pnpm 9, frozen-lockfile in CI |
| Node target | 22.x; `tsconfig` `target: ES2022`, `module/moduleResolution: NodeNext`, `strict: true` |
| Release | Changesets (`@changesets/cli`) |
| Pre-commit | husky + lint-staged (Biome on staged files) |
| Package | `@<personal-handle>/mcp-pear`, `type: module`, `bin: { "mcp-pear": "dist/index.js" }`, `main: "dist/index.js"`, `files: ["dist"]`, `publishConfig: { access: "public" }` |
| Tool naming | `snake_case` (matches polymarket: `get_pair_ratio`, not `GET_PAIR_RATIO`) |
| Output format | Markdown summary (2–4 lines) followed by a fenced ```json``` block with the raw response |

The npm scope is the user's personal handle (provided at publish time). v0.1 explicitly does NOT publish to `@iqai/*`.

---

## 4. File layout

```
mcp-pear/
├─ src/
│  ├─ index.ts                 # #!/usr/bin/env node, FastMCP bootstrap, version from package.json, explicit addTool() per tool
│  ├─ constants.ts             # APP_NAME, APP_VERSION (read at runtime from package.json)
│  ├─ lib/
│  │  ├─ config.ts             # PEAR_API_KEY, PEAR_API_BASE_URL, PEAR_API_TIMEOUT_MS, PEAR_CLIENT_ID
│  │  ├─ http.ts               # fetchJson<T>(), fetchJsonWithRetry<T>(), HttpError class, AbortController-based timeout
│  │  └─ format.ts             # renderResponse(summary, data), formatErrorMessage(err), formatUsd, formatPct, simple table helpers
│  ├─ services/
│  │  ├─ auth.ts               # mintJwt(apiKey, baseUrl, clientId), refreshJwt(refreshToken, baseUrl) — pure functions
│  │  └─ pear-client.ts        # PearClient.getInstance(), endpoint methods, JWT ladder, authedFetch with 401 retry
│  ├─ types.ts                 # zod schemas for every API response DTO; types inferred via z.infer
│  └─ tools/
│     ├─ index.ts              # barrel re-export
│     ├─ get-health.ts
│     ├─ list-markets.ts
│     ├─ get-active-markets.ts
│     ├─ get-pair-ratio.ts
│     ├─ get-account-summary.ts
│     ├─ get-open-positions.ts
│     ├─ get-open-orders.ts
│     ├─ get-twap-orders.ts
│     ├─ get-trade-history.ts
│     └─ get-portfolio.ts
├─ tests/
│  ├─ http.test.ts
│  ├─ auth.test.ts
│  ├─ format.test.ts
│  ├─ pair-ratio.test.ts
│  └─ smoke.test.ts            # gated by PEAR_API_KEY; skipped in CI without secret
├─ examples/
│  ├─ claude-desktop-config.json
│  └─ adk-ts-usage.ts
├─ .github/
│  ├─ workflows/
│  │  ├─ push.yml              # workflow_dispatch by default; flip to push when ready
│  │  ├─ release.yml           # Changesets publish on push to main
│  │  └─ sync-tools.yml        # regenerates README tools table from compiled dist
│  └─ actions/generate-mcp-tools/   # composite action copied verbatim from mcp-polymarket
├─ .changeset/                 # config + initial empty changeset
├─ .husky/                     # pre-commit hook running biome on staged files
├─ biome.json                  # copied from polymarket; same exclusion list (!dist, !build, !**/*.lock, !**/*.log, !**/.next)
├─ tsconfig.json               # ES2022 + NodeNext, strict, types: ["node"]
├─ vitest.config.ts            # tests/**/*.test.ts
├─ package.json
├─ README.md
├─ .env.example
└─ LICENSE                     # MIT
```

### Layer boundaries

- `tools/*` know about MCP and formatting, nothing about HTTP. They call `pearClient.foo()` and pass the result to `renderResponse(summary, data)`.
- `services/pear-client.ts` knows about Pear's endpoints and the JWT ladder, nothing about MCP or formatting. Returns typed data.
- `lib/http.ts` knows about HTTP, retries, timeouts. Generic — could be lifted into a different project unchanged.
- `services/auth.ts` is pure functions; no shared state. Trivially unit-testable.

This three-layer split is the design's main lever for keeping each file small and each unit independently understandable.

---

## 5. Auth lifecycle

### State

```ts
class PearClient {
  private accessToken: string | null = null
  private refreshToken: string | null = null
  // ... endpoint methods
}
```

On construction, the client seeds `accessToken` from `config.jwt` and `refreshToken` from `config.refreshToken` (if those env vars were set). This enables JWT pass-through mode (§10) without changing the ladder.

### `ensureJwt()` ladder

Tries the cheapest path first, falls through on failure:

1. **Cached** — if `accessToken` is set, return it. (In JWT pass-through mode, this is the steady-state path: the externally-minted JWT is used directly until it expires.)
2. **Refresh** — if `refreshToken` is set, call `refreshJwt(refreshToken, baseUrl)`. On success, store rotated tokens and return the new access token. On failure, fall through.
3. **Re-mint** — call `mintJwt(config.apiKey, config.address, baseUrl, clientId)`. Throws `ConfigError` if `PEAR_API_KEY` or `PEAR_ADDRESS` is missing. Stores both tokens, returns access token.

### Behavior by auth mode

- **JWT pass-through (orchestrator-managed)** — typical flow: ladder hits step 1 indefinitely. On 401 mid-session: ladder falls to step 2 if `PEAR_REFRESH_TOKEN` is set, else step 3 if API key + address are also set, else throws `ConfigError("JWT expired; the orchestrator must mint a new one and restart mcp-pear.")`.
- **API key + address** — first call hits step 3 (mint), subsequent calls hit step 1 until 401, then step 2 (refresh), then step 3 again if refresh fails.
- **Public-only** — `ensureJwt()` is never called; only `publicFetch()` paths run.

### `authedFetch<T>(path, init, schema)`

1. Get a token via `ensureJwt()`.
2. Call `fetchJsonWithRetry(path, { ...init, headers: { Authorization: \`Bearer ${token}\` } }, schema)`.
3. On `HttpError(401)`: clear `accessToken` (but keep `refreshToken`), call `ensureJwt()` again (which will now use the refresh path), retry the request once. If it still 401s, surface the error.

This gives two independent retry levels: HTTP-level (handled by `fetchJsonWithRetry`, see §6) and auth-level (one refresh + one re-mint).

---

## 6. HTTP layer

### `fetchJson<T>(url, init, schema?)`

- Applies a timeout via `AbortController` using `config.timeoutMs` (default 10000).
- Throws `HttpError(status, message, body)` on non-2xx.
- If `schema` is provided, runs `schema.parse(json)` and surfaces zod issues as a recognizable error.

### `fetchJsonWithRetry<T>(url, init, schema?, opts = { maxRetries: 3 })`

Wraps `fetchJson` with a retry loop:

- **Retryable**: `HttpError(429)`, `HttpError(5xx)`, `AbortError` (timeout), `TypeError` (network).
- **Not retryable**: any other 4xx (auth failures, bad inputs, missing resource — caller's problem) and zod parse errors (response shape mismatch — code's problem, not transient).
- **Backoff**: `delay = min(2^attempt * 250 + jitter, 5000)` ms with up to 100ms jitter. If a 429 response carries `Retry-After`, that header wins.
- **Total attempts**: initial + 3 retries = 4 attempts max.

Retry state lives entirely in `http.ts` so it's reusable across `mintJwt`, `refreshJwt`, and every `pear-client` method.

---

## 7. Error model

Two custom error classes:

- `ConfigError(message)` — thrown from `config.ts` / `auth.ts` when an authenticated tool is called but the configured auth mode is incomplete (e.g. `PEAR_API_KEY` set but `PEAR_ADDRESS` missing; or pass-through mode's JWT expired and no refresh token / API key fallback is configured). Surfaces a clear "set this env var and restart" message.
- `HttpError(status, message, body?)` — thrown from `http.ts` for any non-2xx. Carries the parsed body when available so caller can inspect `body.message`.

### How tools handle errors

Tools `try`/`catch` and **return error strings** rather than throwing (kalshi/opinion convention — better UX in chat). Format:

| Error | Returned string |
|---|---|
| `ConfigError` (no auth mode) | `PEAR_API_KEY env var is required for \`<tool_name>\`. Set it in your MCP client config and restart.` |
| `ConfigError` (api-key mode missing address) | `PEAR_ADDRESS env var is required for \`<tool_name>\`. Set it to the wallet address bound to your PEAR_API_KEY and restart.` |
| `ConfigError` (pass-through JWT expired, no fallback) | `JWT expired; the orchestrator must mint a new one and restart mcp-pear.` |
| `HttpError(401)` after retry | `Authentication failed (HTTP 401). Verify PEAR_API_KEY (or PEAR_JWT) is valid and try again.` |
| `HttpError(429)` after retries exhausted | `Pear API rate limit exceeded. Try again in a moment.` (includes Retry-After if present) |
| `HttpError(<status>)` other | `Pear API error (HTTP <status>) on <path>: <body.message>` |
| `AbortError` (timeout) | `Request timed out after <ms>ms. Increase PEAR_API_TIMEOUT_MS or check network.` |
| Zod parse error | `Pear API returned an unexpected response shape: <zod issue>. The API may have changed; please file an issue.` |
| Anything else | `Unexpected error: <message>` |

---

## 8. Tools

All ten tools follow the same shape:

```ts
export const fooTool = {
  name: "foo_bar",
  description: "<written for an LLM, explains when to use this tool>",
  parameters: zodSchema,
  execute: async (args: z.infer<typeof zodSchema>) => {
    try {
      const data = await pearClient.foo(args)
      return renderResponse(buildSummary(data), data)
    } catch (err) {
      return formatErrorMessage(err)
    }
  },
}
```

Every zod field has `.describe(...)` so the LLM can pick the right inputs.

### Tool inventory

| # | Name | Auth | Endpoint | Inputs | Summary line |
|---|---|---|---|---|---|
| 1 | `get_health` | – | `GET /health` | none | `Pear API healthy. Uptime: Xs.` |
| 2 | `list_markets` | – | `GET /markets` | `{ search?, engine?, minVolume?, change24h?, netFunding?, sort?, page?, pageSize? }` (pageSize default 20) | `Found N markets (page X of Y). Top by volume: ...` (top 5 inline) |
| 3 | `get_active_markets` | – | `GET /markets/active` | none | `Active: N pairs. Top gainer: ABC +x%. Top loser: DEF -y%.` |
| 4 | `get_pair_ratio` | – | synthesized over `GET /markets` | `{ longAssets: string[], shortAssets: string[] }` | `<L>/<S> ratio: 1.0234 (+2.3% 24h). Funding: -0.0015%.` |
| 5 | `get_account_summary` | ✓ | `GET /accounts` | none | `Account 0xabc... Total closed trades: N. Last synced: <ts>.` |
| 6 | `get_open_positions` | ✓ | `GET /positions` | none | `N open positions. Total unrealized PnL: $X.` + per-position one-liner |
| 7 | `get_open_orders` | ✓ | `GET /orders/open` | none | `N open orders.` |
| 8 | `get_twap_orders` | ✓ | `GET /orders/twap` | none | `N TWAP orders, M chunks total.` |
| 9 | `get_trade_history` | ✓ | `GET /trade-history` | `{ limit?, startDate?, endDate? }` (limit default 50; dates ISO 8601) | `N trades shown. Realized PnL sum: $X.` |
| 10 | `get_portfolio` | ✓ | `GET /portfolio` | none | `Overall: N trades, $X all-time PnL. Last 7d: $Y. Last 30d: $Z.` + bucketed table |

### `get_pair_ratio` synthesis logic

The Pear `name` field encodes composition as `L:<comma-sep-long>|S:<comma-sep-short>`. To resolve a user-supplied `{longAssets, shortAssets}`:

1. Build candidate keys for both orderings of the asset arrays (Pear may sort assets alphabetically internally — try the user's order first, then sorted).
2. Call `GET /markets?searchText=<key>&pageSize=50`.
3. Find an exact `name` match in the result. If found, return `{ ratio, weightedRatio, change24h, weightedChange24h, volume, openInterest, netFunding, name }`.
4. If no exact match, return a helpful error string listing the closest matches by composition.

Unit-tested in `tests/pair-ratio.test.ts` with mocked `/markets` responses.

---

## 9. Output format

`renderResponse(summary: string, data: unknown): string` returns:

```
<summary>

```json
<JSON.stringify(data, null, 2)>
```
```

The summary is 2–4 lines of human-readable prose tailored per tool (see §8 table). The JSON block carries the full structured response so the agent can drill in without re-calling. This is the "both structured and human-readable in the same response" pattern from the original scope.

For tools that return arrays (positions, orders, trade history), the summary may include a small inline table of the top N rows, with the full array in the JSON block.

---

## 10. Configuration

Three auth modes, evaluated in priority order at first authenticated tool call.

### Mode 1 — JWT pass-through (recommended for multi-tenant orchestrators like Telegram bots)

The caller mints the JWT externally (via Privy, EIP-712, or any flow Pear supports) and injects it via env. mcp-pear treats the JWT as an opaque bearer token and never calls `/auth/login` itself.

```
PEAR_JWT=                  # if set, used directly. PEAR_API_KEY / PEAR_ADDRESS are ignored.
PEAR_REFRESH_TOKEN=        # optional. Lets mcp-pear self-refresh once if PEAR_JWT expires mid-session.
```

When `PEAR_JWT` expires and no refresh token is available, authenticated tools surface `JWT expired; the orchestrator must mint a new one and restart mcp-pear.` The orchestrator (e.g. Telegram bot) is responsible for re-minting and respawning the subprocess.

### Mode 2 — API key + wallet address (single-user / Claude Desktop / power users)

mcp-pear mints the JWT itself via `POST /auth/login`. Both fields required because the OpenAPI spec requires `address` in the request body alongside the API key.

```
PEAR_API_KEY=              # the user's Pear API key
PEAR_ADDRESS=              # the wallet address bound to the API key (0x...)
```

### Public-only mode (no auth)

If neither mode is configured, the four public tools still work (`get_health`, `list_markets`, `get_active_markets`, `get_pair_ratio`). Authenticated tools throw `ConfigError` at call time (not at startup), naming which env var is missing.

### Common settings

```
PEAR_API_BASE_URL=https://hl-v2.pearprotocol.io   # default
PEAR_API_TIMEOUT_MS=10000                         # default
PEAR_CLIENT_ID=APITRADER                          # default; sent to /auth/login
```

`config.ts` validates only at use site, not at startup, so public-only sessions don't need any auth env vars.

---

## 11. Testing

| File | What it covers | Approx LoC |
|---|---|---|
| `tests/http.test.ts` | `fetchJson` happy path, `HttpError` on non-2xx, timeout via mocked `AbortController`. `fetchJsonWithRetry`: 429 with Retry-After, 5xx exponential, non-retryable 4xx, max-retries exhaustion, zod-error non-retryable. | ~120 |
| `tests/auth.test.ts` | `mintJwt` request body shape, response parsing. `refreshJwt` same. `PearClient.ensureJwt` ladder: cached → refresh → re-mint, with http layer mocked. | ~70 |
| `tests/format.test.ts` | `renderResponse` shape. `formatUsd`/`formatPct` edge cases (zero, negative, undefined, large numbers). | ~30 |
| `tests/pair-ratio.test.ts` | Key construction (both asset orderings), exact-match selection, no-match error string. | ~40 |
| `tests/smoke.test.ts` | `it.skipIf(!process.env.PEAR_API_KEY)` — calls `get_health` + `list_markets` + `get_account_summary` against live API; asserts shape only. | ~20 |

Total: ~280 lines of tests for ~600 lines of source. Heavy on the bits with logic (auth, retry, synthesis), light on shape passthrough.

---

## 12. README structure

1. Title + npm and CI badges
2. **What is mcp-pear** — 1 paragraph
3. **What is Pear Protocol** — 1 paragraph + link to pearprotocol.io
4. **Features** — bullet list of the 10 tools, one line each
5. **Installation** — `npx @<handle>/mcp-pear` and `pnpm install -g @<handle>/mcp-pear`
6. **Configuration** — env-var table from §10
7. **Claude Desktop usage** — full `claude_desktop_config.json` snippet
8. **ADK-TS usage** — minimal `McpToolset` code example (added per scope; not in IQAI repos)
9. **Tools** — auto-generated table between `<!-- AUTO-GENERATED TOOLS START -->` / `END` markers via the copied `sync-tools` action
10. **Development** — build / test / lint commands
11. **Roadmap**
    - **v0.2** — trade execution (open / close / adjust positions; place / cancel orders; leverage; TP/SL), agent wallet creation/approval flow, candle synthesis from Hyperliquid
    - **v0.3** — WebSocket streaming, Telegram bot wrapper (separate repo)
12. **Disclaimer** — not affiliated with Pear Protocol; experimental, no warranty, use at your own risk; v0.1 is read-only and therefore avoids custodial risk
13. **License** — MIT

---

## 13. Out of scope for v0.1 (called out in README)

- Trade execution: `POST /positions`, `POST /positions/{id}/close`, `POST /positions/close-all`, `POST /positions/{id}/adjust`, `POST /positions/{id}/adjust-advance`, `POST /positions/{id}/adjust-leverage`, `PUT /positions/{id}/riskParameters`, `DELETE /orders/{id}/cancel`, `POST /orders/{id}/twap/cancel`, `POST /orders/spot`
- Agent wallet creation/approval flow
- Pair candles (no public source endpoint; v0.2 may synthesize from Hyperliquid `candleSnapshot`)
- WebSocket / streaming
- Telegram bot wrapper

---

## 14. Demo deliverables

- `examples/claude-desktop-config.json` — copy-pasteable snippet with placeholder for `PEAR_API_KEY`
- `examples/adk-ts-usage.ts` — minimal `McpToolset` example
- 30–60 second Loom recording: Claude Desktop calling `get_active_markets` → `get_pair_ratio` for a user-named pair → `get_portfolio` → asking Claude to summarize. (Drops the candles bit from the original scope; the active → zoom → portfolio narrative is stronger because it shows discovery, drill-down, and personalization.)

---

## 15. Order of execution

1. Scaffold (`package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `.changeset/`, `.husky/`, `.github/`, `src/` skeleton, `tests/` skeleton)
2. `lib/http.ts` + `lib/format.ts` + `lib/config.ts` with full unit tests passing
3. `services/auth.ts` (`mintJwt`, `refreshJwt`) with unit tests
4. `services/pear-client.ts` skeleton with `ensureJwt` ladder + `authedFetch` 401 retry, mocked-http unit tests
5. **End-to-end vertical slice** — implement `get_health` only, wire FastMCP server in `index.ts`, run `node dist/index.js` and confirm in Claude Desktop. This validates the whole pipeline before scaling out. **This is also where the `address`-in-`/auth/login` known-unknown gets resolved live.**
6. Implement remaining public tools: `list_markets`, `get_active_markets`, `get_pair_ratio` (with synthesis tests)
7. Implement authenticated tools: `get_account_summary`, `get_open_positions`, `get_open_orders`, `get_twap_orders`, `get_trade_history`, `get_portfolio`
8. README + `examples/*` + record demo Loom
9. Copy `.github/actions/generate-mcp-tools/` from mcp-polymarket; verify auto-generated tools table renders correctly
10. `pnpm publish` under personal scope; tag `v0.1.0` on GitHub

---

## 16. Constraints (from original scope, preserved)

- **No invented endpoints** — every path is verified against the live API. The original `/market-data/*` endpoints are dropped because they returned 404.
- **No real API keys committed** anywhere, including examples.
- **Personal npm scope only** — do not publish to `@iqai/*` for v0.1.
- **No non-public Pear product information** in code, comments, README, or commit messages.
- **No trade execution in v0.1** even if it looks easy.
