# mcp-pear

[![npm](https://img.shields.io/npm/v/@marvelcodes/mcp-pear.svg)](https://www.npmjs.com/package/@marvelcodes/mcp-pear)
[![CI](https://github.com/MarvelNwachukwu/mcp-pear/actions/workflows/push.yml/badge.svg)](https://github.com/MarvelNwachukwu/mcp-pear/actions)

**The Pear Protocol MCP server for Hyperliquid pair trading** — connect Claude, Cursor, or any AI agent to on-chain perps: browse pair markets, read positions and portfolio, and (opt-in) execute pair trades.

Model Context Protocol (MCP) server for [Pear Protocol](https://pearprotocol.io). Gives Claude, or any MCP-compatible agent, access to markets, pair ratios, positions, orders, trade history, portfolio, and (v0.2) full trade execution on Hyperliquid.

> **v0.2 adds trade execution.** Ten write tools (open, close, and adjust positions; manage leverage and risk; cancel orders) are off by default behind `PEAR_TRADE_ENABLED=true`. Pear signs server-side, so mcp-pear never holds private keys.

## What is Pear Protocol?

Pear is a Hyperliquid-backed perps platform for **pair markets**: long one basket against another. Every pair has a live ratio that moves as the legs diverge. More at [pearprotocol.io](https://pearprotocol.io).

## Tools

Public (no auth):

- `get_health`: API health and uptime
- `list_markets`: browse pair markets with filters and pagination
- `get_active_markets`: top gainers, losers, and highlighted pairs
- `get_pair_ratio`: current ratio, 24h change, and funding for a specific pair

Authenticated read:

- `get_account_summary`: your account header
- `get_open_positions`: your open positions with PnL
- `get_open_orders`: your open limit, TP, and SL orders
- `get_twap_orders`: your active TWAP orders
- `get_trade_history`: your closed trades with realized PnL
- `get_portfolio`: bucketed PnL across 1d, 1w, 1m, 1y, and all-time
- `get_agent_wallet`: the agent wallet Pear uses to sign your trades

Authenticated write (v0.2, gated behind `PEAR_TRADE_ENABLED=true`):

- `create_agent_wallet`: create the agent wallet
- `open_position`, `close_position`, `close_all_positions`: open and close pair positions
- `adjust_position`, `adjust_leverage`: change size or leverage on a live position
- `set_risk_parameters`: set or update TP and SL
- `cancel_order`, `cancel_twap_order`: cancel pending orders

Full parameter reference in [Tool reference](#tool-reference). See [Trade execution (v0.2)](#trade-execution-v02) for the gate and Hyperliquid funding rules.

## Install

```bash
# Run directly
npx -y @marvelcodes/mcp-pear@latest

# Or install globally
pnpm install -g @marvelcodes/mcp-pear
mcp-pear
```

> **Pin `@latest` (or a specific version) in the npx spec.** Plain `npx @marvelcodes/mcp-pear` can launch a stale cached version: npx prefers its local cache over the npm registry when the spec is unpinned, so after a new release lands you may still be running the old one. `@latest` re-resolves against the registry each launch; pin like `@0.2.0` instead if you want a frozen version. Stuck on an old version after upgrading? Clear the npx cache: `rm -rf ~/.npm/_npx` (macOS/Linux).

## Getting an API key

For the authenticated tools, mint a key:

```bash
npx -y @marvelcodes/mcp-pear@latest setup
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
      "args": ["-y", "@marvelcodes/mcp-pear@latest"],
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
		args: ["-y", "@marvelcodes/mcp-pear@latest"],
		env: { PEAR_API_KEY: process.env.PEAR_API_KEY ?? "", PEAR_ADDRESS: process.env.PEAR_ADDRESS ?? "" },
	}),
});

await pearTools.connect();
const tools = await pearTools.listTools();
```

Full example in [`examples/adk-ts-usage.ts`](./examples/adk-ts-usage.ts).

## Tool reference

<!-- AUTO-GENERATED TOOLS START -->

### `adjust_leverage`
Change leverage (1-100x) on an existing Pear Protocol position. Higher leverage means greater liquidation risk for the same price move. WRITE: changes risk profile of a live position. Requires PEAR_TRADE_ENABLED=true.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `positionId` | string | yes |  |
| `leverage` | integer | yes |  |

### `adjust_position`
Reduce or increase an existing Pear Protocol position's size by 1-100 percent. executionType: MARKET (immediate) or LIMIT (provide limitRatio). WRITE: changes exposure on a real trade. Requires PEAR_TRADE_ENABLED=true.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `positionId` | string | yes |  |
| `adjustmentType` | string | yes |  |
| `adjustmentSize` | integer | yes |  |
| `executionType` | string | yes |  |
| `limitRatio` | number |  |  |
| `referralCode` | string |  |  |

### `cancel_order`
Cancel a pending Pear Protocol limit, take-profit, or stop-loss order by orderId. Does not affect already-filled portions. For TWAP orders, use cancel_twap_order. WRITE: cancels a live order. Requires PEAR_TRADE_ENABLED=true.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderId` | string | yes |  |

### `cancel_twap_order`
Cancel a Pear Protocol TWAP (time-weighted average price) order and all of its remaining unfilled chunks. WRITE: cancels a live order. Requires PEAR_TRADE_ENABLED=true.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderId` | string | yes |  |

### `close_all_positions`
Close every open Pear Protocol position with a single executionType (MARKET or TWAP). Returns a per-position result array with success/error. WRITE: executes real trades. Requires PEAR_TRADE_ENABLED=true.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `executionType` | string | yes |  |
| `twapDuration` | number |  |  |
| `twapIntervalSeconds` | number |  |  |
| `randomizeExecution` | boolean |  |  |
| `referralCode` | string |  |  |

### `close_position`
Close one open Pear Protocol position by positionId. executionType: MARKET (immediate) or TWAP (spread over time; requires twapDuration in seconds). WRITE: executes a real trade. Requires PEAR_TRADE_ENABLED=true.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `positionId` | string | yes |  |
| `executionType` | string | yes |  |
| `twapDuration` | number |  |  |
| `twapIntervalSeconds` | number |  |  |
| `randomizeExecution` | boolean |  |  |
| `referralCode` | string |  |  |

### `create_agent_wallet`
Create a new Pear Protocol agent wallet for the authenticated user. The agent wallet is what Pear uses to sign Hyperliquid trades. After creation, the user MUST approve this wallet on Hyperliquid (the response message contains the approval instructions). WRITE: executes a state change. Requires PEAR_TRADE_ENABLED=true.

_No parameters_

### `get_account_summary`
Get the authenticated user's Pear Protocol account summary: agent wallet address, total closed trades, pending trigger-order USD value, pending TWAP-chunk USD value, and last sync timestamp. Requires PEAR_API_KEY.

_No parameters_

### `get_active_markets`
Get the most active Pear Protocol pair markets right now: current active pairs plus top gainers, top losers, highlighted pairs, and the user's watchlist. Use to see what's hot or as a starting point for narrowing into a specific pair.

_No parameters_

### `get_agent_wallet`
Get the authenticated user's Pear Protocol agent wallet address. The agent wallet is what Pear uses to sign Hyperliquid trades on the user's behalf. Returns an empty/missing address if no agent wallet has been created yet; call create_agent_wallet to create one.

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

### `open_position`
Open a new pair position on Pear Protocol. Specify executionType (MARKET / TRIGGER / TWAP / LADDER / TP / SL / SYNC), leverage (1-100), usdValue (≥1), slippage (0.001-0.1), and the long/short asset compositions (arrays of { asset, weight }). Optionally attach stopLoss/takeProfit and TWAP/TRIGGER/LADDER parameters. WRITE: executes a real trade. Requires PEAR_TRADE_ENABLED=true.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `executionType` | string | yes |  |
| `leverage` | integer | yes |  |
| `usdValue` | number | yes |  |
| `slippage` | number | yes |  |
| `longAssets` | array | yes |  |
| `shortAssets` | array | yes |  |
| `triggerValue` | number |  |  |
| `triggerType` | string |  |  |
| `direction` | string |  |  |
| `twapDuration` | number |  |  |
| `twapIntervalSeconds` | number |  |  |
| `randomizeExecution` | boolean |  |  |
| `ladderConfig` | object |  |  |
| `stopLoss` | unknown |  |  |
| `takeProfit` | unknown |  |  |
| `referralCode` | string |  |  |

### `set_risk_parameters`
Set or update stop-loss / take-profit on an existing Pear Protocol position. Each threshold has type ('PRICE' or 'PERCENTAGE'), value, and optional trailing fields. Pass null to clear a field; omit it to leave unchanged. WRITE: changes risk parameters on a live position. Requires PEAR_TRADE_ENABLED=true.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `positionId` | string | yes |  |
| `stopLoss` | unknown |  |  |
| `takeProfit` | unknown |  |  |

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

## Trade execution (v0.2)

Ten new tools that take mcp-pear from read-only to write. **All write tools are off by default.** Set `PEAR_TRADE_ENABLED=true` to unlock them (strict literal match on `"true"`; anything else, including `"True"`, `"1"`, or `"yes"`, keeps writes disabled). Pear signs trades server-side via an agent wallet you create, so mcp-pear never holds private keys for trades.

| Tool | Type | Description |
|---|---|---|
| `get_agent_wallet`     | read  | Get the agent wallet Pear uses to sign your trades. |
| `create_agent_wallet`  | write | Create one. After creation, approve it on Hyperliquid (the response message contains the instructions). |
| `open_position`        | write | Open a pair position. Supports MARKET, TRIGGER, TWAP, LADDER, TP, SL, SYNC. |
| `close_position`       | write | Close one position by id (MARKET or TWAP). |
| `close_all_positions`  | write | Close every open position with one execution type. |
| `adjust_position`      | write | Reduce or increase position size by 1 to 100 percent. MARKET or LIMIT. |
| `adjust_leverage`      | write | Set leverage 1 to 100x on an existing position. Carries liquidation risk. |
| `set_risk_parameters`  | write | Set or update TP and SL on an existing position. |
| `cancel_order`         | write | Cancel a pending limit, TP, or SL order. |
| `cancel_twap_order`    | write | Cancel a TWAP order and its remaining chunks. |

| Env var | Default | Description |
|---|---|---|
| `PEAR_TRADE_ENABLED` | unset | Set to `"true"` (lowercase, exact) to unlock the write tools. Anything else keeps them disabled and the gate error is returned to the LLM. |

When `PEAR_TRADE_ENABLED=true`, mcp-pear logs `[mcp-pear] PEAR_TRADE_ENABLED=true. Trade execution unlocked.` to stderr on startup so operators can see writes are live.

### Funding and minimums

Trades execute on Hyperliquid, which margins positions from your **Perps** balance. Two things bite first-time operators:

- **Minimum order size.** Hyperliquid rejects orders below ~$10 notional. `usdValue` is the position's USD notional (margin = `usdValue / leverage`), so a single-leg position needs `usdValue` at or above 10. A long plus short pair is two separate orders, each subject to the $10 floor (about $20 or more notional total).
- **Spot vs Perps balance.** USDC bridged onto Hyperliquid (for example via Circle CCTP) often lands in your **Spot** balance. Move it to **Perps** in the Hyperliquid app before trading, or `open_position` fails with insufficient margin.

## What's next

**v0.3.** WebSocket streaming for real-time market and position updates. Spot orders. Candle synthesis from Hyperliquid `candleSnapshot`.

## FAQ

**What is the Pear Protocol MCP server?**
`mcp-pear` is a Model Context Protocol (MCP) server that gives Claude and other AI agents access to [Pear Protocol](https://pearprotocol.io) — a Hyperliquid-backed platform for **pair trading** (long one basket against another). It exposes tools to browse pair markets and ratios, read positions, orders, and portfolio, and optionally execute pair trades.

**How do I build a Pear Protocol trading agent?**
Point any MCP client at `npx -y @marvelcodes/mcp-pear@latest`. The agent gets read tools out of the box (markets, ratios, positions, portfolio). To let it trade, set `PEAR_TRADE_ENABLED=true` and add `PEAR_API_KEY` + `PEAR_ADDRESS`; it can then call `open_position` (MARKET / TRIGGER / TWAP / LADDER), `close_position`, `adjust_leverage`, and `set_risk_parameters`. See [Claude Desktop](#claude-desktop) and [ADK-TS](#adk-ts) for wiring examples.

**Does it support Hyperliquid pair trading?**
Yes. Pear runs on Hyperliquid, so every pair position is a long/short perp trade executed on Hyperliquid. `mcp-pear` covers the full lifecycle: open, adjust, set TP/SL, and close.

**Is this the official Pear Protocol MCP server?**
No. `mcp-pear` is an independent, open-source community project that wraps Pear's public API. It is not affiliated with or endorsed by Pear Protocol.

## Disclaimer

Not affiliated with Pear Protocol. Independent wrapper around Pear's public API. v0.2 trade-execution tools are off by default and require explicit operator opt-in (`PEAR_TRADE_ENABLED=true`). Pear signs server-side, so mcp-pear never holds private keys. Use at your own risk; no warranty.

## License

MIT. See [LICENSE](./LICENSE).
