# mcp-pear

[![npm](https://img.shields.io/npm/v/@marvelcodes/mcp-pear.svg)](https://www.npmjs.com/package/@marvelcodes/mcp-pear)
[![CI](https://github.com/MarvelNwachukwu/mcp-pear/actions/workflows/push.yml/badge.svg)](https://github.com/MarvelNwachukwu/mcp-pear/actions)

Read-only Model Context Protocol (MCP) server for [Pear Protocol](https://pearprotocol.io). Gives Claude, or any MCP-compatible agent, access to markets, pair ratios, positions, orders, trade history, and portfolio.

> **v0.1 is read-only.** No signing, no execution, no custody risk. Trade execution lands in v0.2.

## What is Pear Protocol?

Pear is a Hyperliquid-backed perps platform for **pair markets**: long one basket against another. Every pair has a live ratio that moves as the legs diverge. More at [pearprotocol.io](https://pearprotocol.io).

## Tools

Public (no auth):

- `get_health`: API health and uptime
- `list_markets`: browse pair markets with filters and pagination
- `get_active_markets`: top gainers, losers, and highlighted pairs
- `get_pair_ratio`: current ratio, 24h change, and funding for a specific pair

Authenticated:

- `get_account_summary`: your account header
- `get_open_positions`: your open positions with PnL
- `get_open_orders`: your open limit, TP, and SL orders
- `get_twap_orders`: your active TWAP orders
- `get_trade_history`: your closed trades with realized PnL
- `get_portfolio`: bucketed PnL across 1d, 1w, 1m, 1y, and all-time

Full parameter reference in [Tool reference](#tool-reference).

## Install

```bash
# Run directly
npx -y @marvelcodes/mcp-pear

# Or install globally
pnpm install -g @marvelcodes/mcp-pear
mcp-pear
```

## Getting an API key

For the authenticated tools, mint a key:

```bash
npx -y @marvelcodes/mcp-pear setup
```

The CLI opens a browser, asks you to sign once with your wallet, mints a Pear API key, and (optionally) writes `PEAR_API_KEY` and `PEAR_ADDRESS` to a `.env`. Copy those two values into your Claude Desktop config and restart Claude.

> Already have a JWT from `app.pear.garden`? Skip `setup` and use **JWT pass-through** below.

## Configuration

Three auth modes. mcp-pear uses the first one whose env vars are set, decided on the first authenticated call.

### Mode 1: JWT pass-through (multi-tenant orchestrators)

For Telegram bots and other orchestrators that mint JWTs externally (Privy, EIP-712, or any Pear-supported flow). The JWT is opaque; mcp-pear never calls `/auth/login`.

| Env var | Required | Description |
|---|---|---|
| `PEAR_JWT` | yes | Pre-minted access token. Used directly when set. `PEAR_API_KEY` and `PEAR_ADDRESS` act as fallback if the JWT expires and no `PEAR_REFRESH_TOKEN` is configured. |
| `PEAR_REFRESH_TOKEN` | no | If set, mcp-pear refreshes the JWT itself when it expires mid-session (each refresh rotates the token). Without it, the orchestrator has to re-mint and respawn the subprocess. |

When `PEAR_JWT` expires and no refresh token is set, authenticated tools return:

> `JWT expired; the orchestrator must mint a new one and restart mcp-pear.`

See [`examples/telegram-bot-usage.ts`](./examples/telegram-bot-usage.ts) for the orchestrator pattern.

### Mode 2: API key + wallet address (single-user, Claude Desktop)

| Env var | Required | Description |
|---|---|---|
| `PEAR_API_KEY` | for auth tools | Your Pear API key. |
| `PEAR_ADDRESS` | for auth tools | Wallet address bound to the API key (`0x...`). |

mcp-pear mints the JWT itself by calling `POST /auth/login`. Both fields are required: the OpenAPI spec needs `address` in the request body.

### Public-only mode

The four public tools work without any auth env vars. Authenticated tools return a `ConfigError` naming the missing env var.

### Common settings (optional)

| Env var | Default | Description |
|---|---|---|
| `PEAR_API_BASE_URL` | `https://hl-v2.pearprotocol.io` | Pear API host. |
| `PEAR_API_TIMEOUT_MS` | `10000` | Per-request timeout. |
| `PEAR_CLIENT_ID` | `APITRADER` | Client identifier sent to `/auth/login`. |

## Claude Desktop

Add to `claude_desktop_config.json`:

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

## ADK-TS

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

## Tool reference

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
| `longAssets` | array | yes | Asset symbols on the long side (e.g. ['BTC']). |
| `shortAssets` | array | yes | Asset symbols on the short side. Pass an empty array for long-only baskets. |

### `get_portfolio`
Fetch the authenticated user's full portfolio metrics on Pear Protocol: bucketed PnL across last 1 day / 1 week / 1 month / 1 year / all-time, plus overall stats (total trades, all-time volume, current open interest, unrealized PnL). Requires PEAR_API_KEY.

_No parameters_

### `get_trade_history`
Fetch the authenticated user's recent closed trades on Pear Protocol with realized PnL, entry/exit ratios, and pair composition. Optional date range and limit. Requires PEAR_API_KEY.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer |  | Max number of trades to return. Default 50. |
| `startDate` | string |  | ISO 8601 timestamp or epoch ms. Only return trades on or after this time. |
| `endDate` | string |  | ISO 8601 timestamp or epoch ms. Only return trades on or before this time. |

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
| `page` | integer |  | Page number (1-indexed). |
| `pageSize` | integer |  | Results per page. Default 20. |

<!-- AUTO-GENERATED TOOLS END -->

## Development

```bash
pnpm install
pnpm run build
pnpm test
pnpm run lint
pnpm run format
```

Live smoke tests:

```bash
PEAR_API_KEY=<real> pnpm test smoke
```

## What's next

**v0.2: trade execution.** Ten new tools that take mcp-pear from read-only to write: open, close, and adjust positions; set leverage and TP/SL; cancel limit, TP, SL, and TWAP orders; create and approve the agent wallet. All gated behind `PEAR_TRADE_ENABLED=true` (off by default, strict literal match). Pear signs trades server-side via the agent wallet, so mcp-pear never holds private keys.

**v0.3.** WebSocket streaming for real-time market and position updates. Spot orders. Candle synthesis from Hyperliquid `candleSnapshot`.

## Disclaimer

Not affiliated with Pear Protocol. Independent wrapper around Pear's public API. v0.1 never signs or sends transactions, so there is no custodial risk. Use at your own risk; no warranty.

## License

MIT. See [LICENSE](./LICENSE).
