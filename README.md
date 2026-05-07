# mcp-pear

[![npm](https://img.shields.io/npm/v/@marvelcodes/mcp-pear.svg)](https://www.npmjs.com/package/@marvelcodes/mcp-pear)
[![CI](https://github.com/marvelcodes/mcp-pear/actions/workflows/push.yml/badge.svg)](https://github.com/marvelcodes/mcp-pear/actions)

A read-only Model Context Protocol (MCP) server exposing [Pear Protocol](https://pearprotocol.io)'s trading API to AI agents. Use it to let Claude (or any MCP-compatible agent) browse markets, check the ratio of any pair, and read your account/positions/orders/trade-history/portfolio.

> **v0.1 is read-only** — no signing, no trade execution, no custody risk. Trade execution is on the v0.2 roadmap.

## What is Pear Protocol?

Pear Protocol is a Hyperliquid-backed perpetuals platform for trading **pair markets** — long one basket, short another. Every pair has a live ratio that moves as the underlying assets diverge. Learn more at [pearprotocol.io](https://pearprotocol.io).

## Features

- `get_health` — API health and uptime
- `list_markets` — browse pair markets with filters and pagination
- `get_active_markets` — top gainers / losers / highlighted pairs
- `get_pair_ratio` — current ratio + 24h change + funding for a specific pair
- `get_account_summary` — your account header (auth)
- `get_open_positions` — your open positions with PnL (auth)
- `get_open_orders` — your open limit/TP/SL orders (auth)
- `get_twap_orders` — your active TWAP orders (auth)
- `get_trade_history` — your closed trades with realized PnL (auth)
- `get_portfolio` — bucketed PnL across 1d/1w/1m/1y/all-time (auth)

## Installation

```bash
# Run directly
npx -y @marvelcodes/mcp-pear

# Or install globally
pnpm install -g @marvelcodes/mcp-pear
mcp-pear
```

## Configuration

mcp-pear supports three auth modes. The first one whose env vars are set wins at first authenticated tool call.

### Mode 1 — JWT pass-through (recommended for multi-tenant orchestrators)

For Telegram bots and other orchestrators that mint JWTs externally (e.g. via Privy, EIP-712, or any flow Pear supports). mcp-pear treats the JWT as opaque and never calls `/auth/login`.

| Env var | Required | Description |
|---|---|---|
| `PEAR_JWT` | yes | Pre-minted access token. When set, PEAR_API_KEY/PEAR_ADDRESS are ignored. |
| `PEAR_REFRESH_TOKEN` | no | If set, mcp-pear self-refreshes once when PEAR_JWT expires mid-session. Otherwise the orchestrator must re-mint and respawn the subprocess. |

When `PEAR_JWT` expires and no refresh token is available, authenticated tools return:
> `JWT expired; the orchestrator must mint a new one and restart mcp-pear.`

See [`examples/telegram-bot-usage.ts`](./examples/telegram-bot-usage.ts) for the orchestrator pattern.

### Mode 2 — API key + wallet address (single-user / Claude Desktop)

| Env var | Required | Description |
|---|---|---|
| `PEAR_API_KEY` | for auth tools | Your Pear API key. |
| `PEAR_ADDRESS` | for auth tools | The wallet address bound to the API key (`0x...`). |

mcp-pear mints the JWT itself by calling `POST /auth/login`. Both fields are required because the OpenAPI spec requires `address` in the request body.

### Public-only mode (no auth)

The four public tools (`get_health`, `list_markets`, `get_active_markets`, `get_pair_ratio`) work without any auth env vars. Authenticated tools return a `ConfigError` describing which env var is missing.

### Common settings (optional)

| Env var | Default | Description |
|---|---|---|
| `PEAR_API_BASE_URL` | `https://hl-v2.pearprotocol.io` | Pear API host. |
| `PEAR_API_TIMEOUT_MS` | `10000` | Per-request timeout. |
| `PEAR_CLIENT_ID` | `APITRADER` | Client identifier sent to `/auth/login`. |

## Claude Desktop usage

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pear": {
      "command": "npx",
      "args": ["-y", "@marvelcodes/mcp-pear"],
      "env": {
        "PEAR_API_KEY": "your-pear-api-key-here",
        "PEAR_ADDRESS": "0xYourWalletAddress"
      }
    }
  }
}
```

Restart Claude Desktop and ask: "Use Pear to show me the top active markets right now."

## ADK-TS usage

```ts
import { McpToolset, StdioTransport } from "@iqai/adk";

const pearTools = new McpToolset({
	transport: new StdioTransport({
		command: "npx",
		args: ["-y", "@marvelcodes/mcp-pear"],
		env: { PEAR_API_KEY: process.env.PEAR_API_KEY ?? "", PEAR_ADDRESS: process.env.PEAR_ADDRESS ?? "" },
	}),
});

await pearTools.connect();
const tools = await pearTools.listTools();
```

Full example in [`examples/adk-ts-usage.ts`](./examples/adk-ts-usage.ts).

## Tools

<!-- AUTO-GENERATED TOOLS START -->

### `get_account_summary`
Get the authenticated user's Pear Protocol account summary: agent wallet address, total closed trades, pending trigger-order USD value, pending TWAP-chunk USD value, and last sync timestamp. Requires PEAR_API_KEY.

_No parameters_

### `get_active_markets`
Get the most active Pear Protocol pair markets right now: current active pairs plus top gainers, top losers, highlighted pairs, and the user's watchlist. Use to see what's hot or as a starting point for narrowing into a specific pair.

_No parameters_

### `get_health`
Check Pear Protocol API health. Returns service status, server timestamp, and uptime in seconds. Use this to verify the API is reachable before running other tools.

_No parameters_

### `get_open_orders`
List the authenticated user's open limit, take-profit, and stop-loss orders on Pear Protocol. Returns each order's ID, type, status, and pair composition. Requires PEAR_API_KEY.

_No parameters_

### `get_open_positions`
List the authenticated user's currently open Pear Protocol pair positions, including position ID, entry ratio, mark ratio, unrealized PnL, and long/short composition. Requires PEAR_API_KEY.

_No parameters_

### `get_pair_ratio`
Get the current ratio (long/short composition price) for a specific Pear Protocol pair. Pass long and short asset arrays. Returns the ratio, 24h change, and funding rate. Useful when you know the pair you care about and want the latest number.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `longAssets` | string | ✅ | Asset symbols on the long side (e.g. ['BTC']). |
| `shortAssets` | string | ✅ | Asset symbols on the short side. Pass an empty array for long-only baskets. |

### `get_portfolio`
Fetch the authenticated user's full portfolio metrics on Pear Protocol: bucketed PnL across last 1 day / 1 week / 1 month / 1 year / all-time, plus overall stats (total trades, all-time volume, current open interest, unrealized PnL). Requires PEAR_API_KEY.

_No parameters_

### `get_trade_history`
Fetch the authenticated user's recent closed trades on Pear Protocol with realized PnL, entry/exit ratios, and pair composition. Optional date range and limit. Requires PEAR_API_KEY.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number |  | Max number of trades to return. Default 50. |
| `startDate` | string |  | ISO 8601 timestamp or epoch ms — only return trades on or after this time. |
| `endDate` | string |  | ISO 8601 timestamp or epoch ms — only return trades on or before this time. |

### `get_twap_orders`
List the authenticated user's active TWAP (time-weighted average price) orders on Pear Protocol, including chunk execution and fill detail. Requires PEAR_API_KEY.

_No parameters_

### `list_markets`
Browse Pear Protocol pair markets with optional filters and pagination. Each market is a long/short composition with current ratio, 24h change, volume, open interest, and funding. Use to discover what's tradable, or with searchText to find a specific pair.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string |  | Free-text search across market names (composition keys like `L:BTC|S:ETH`). |
| `engine` | string |  | Filter by execution engine. |
| `minVolume` | number |  | Minimum 24h volume in USD. |
| `change24h` | number |  | Minimum 24h ratio change (e.g. 0.05 for +5%). |
| `netFunding` | number |  | Filter by net funding rate. |
| `sort` | string |  | Sort key (e.g. 'volume', 'change24h'). |
| `page` | number |  | Page number (1-indexed). |
| `pageSize` | number |  | Results per page. Default 20. |

<!-- AUTO-GENERATED TOOLS END -->

## Development

```bash
pnpm install
pnpm run build           # tsc → dist/
pnpm test                # vitest run
pnpm run lint            # biome check
pnpm run format          # biome format --write
```

Live smoke tests:

```bash
PEAR_API_KEY=<real> pnpm test smoke
```

## Roadmap

- **v0.2** — trade execution (open / close / adjust positions, place / cancel orders, leverage, TP/SL), agent wallet creation/approval flow, candle synthesis from Hyperliquid `candleSnapshot`
- **v0.3** — WebSocket streaming, Telegram bot wrapper (separate repo)

## Disclaimer

This project is **not affiliated with Pear Protocol**. It's an independent, experimental wrapper that calls Pear's public API. v0.1 is read-only — it never signs or sends transactions, so there is no custodial risk. Use at your own risk; no warranty is provided.

## License

MIT — see [LICENSE](./LICENSE).
