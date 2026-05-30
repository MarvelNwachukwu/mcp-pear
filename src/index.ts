#!/usr/bin/env node
import { APP_NAME, APP_VERSION } from "./constants.js";

const cmd = process.argv[2];

if (cmd === "setup") {
	const { runSetup } = await import("./cli/setup.js");
	await runSetup();
	process.exit(0);
}

if (cmd === "--help" || cmd === "-h") {
	printHelp();
	process.exit(0);
}

if (cmd === "--version" || cmd === "-v") {
	console.log(`${APP_NAME} ${APP_VERSION}`);
	process.exit(0);
}

await startServer();

async function startServer(): Promise<void> {
	const { FastMCP } = await import("fastmcp");
	const tools = await import("./tools/index.js");
	const server = new FastMCP({
		name: APP_NAME,
		version: APP_VERSION as `${number}.${number}.${number}`,
	});
	// v0.1: read tools
	server.addTool(tools.getHealthTool);
	server.addTool(tools.listMarketsTool);
	server.addTool(tools.getActiveMarketsTool);
	server.addTool(tools.getPairRatioTool);
	server.addTool(tools.getAccountSummaryTool);
	server.addTool(tools.getOpenPositionsTool);
	server.addTool(tools.getOpenOrdersTool);
	server.addTool(tools.getTradeHistoryTool);
	server.addTool(tools.getTwapOrdersTool);
	server.addTool(tools.getPortfolioTool);
	// v0.2: agent wallet (1 read, 1 write)
	server.addTool(tools.getAgentWalletTool);
	server.addTool(tools.createAgentWalletTool);
	// v0.2: trade execution writes (gated on PEAR_TRADE_ENABLED=true)
	server.addTool(tools.openPositionTool);
	server.addTool(tools.closePositionTool);
	server.addTool(tools.closeAllPositionsTool);
	server.addTool(tools.adjustPositionTool);
	server.addTool(tools.adjustLeverageTool);
	server.addTool(tools.setRiskParametersTool);
	server.addTool(tools.cancelOrderTool);
	server.addTool(tools.cancelTwapOrderTool);

	if (process.env.PEAR_TRADE_ENABLED === "true") {
		console.error(
			"[mcp-pear] PEAR_TRADE_ENABLED=true. Trade execution unlocked.",
		);
	}
	await server.start({ transportType: "stdio" });
}

function printHelp(): void {
	console.log(`${APP_NAME} ${APP_VERSION}

Usage:
  mcp-pear              Start the MCP server over stdio (default).
  mcp-pear setup        Mint a Pear API key for your wallet (interactive).
  mcp-pear --version    Print version.
  mcp-pear --help       Print this help.

Environment:
  PEAR_API_KEY          Pear API key (single-user mode).
  PEAR_ADDRESS          Wallet address bound to the API key.
  PEAR_JWT              Pre-minted access token (orchestrator mode).
  PEAR_REFRESH_TOKEN    Optional refresh token (pairs with PEAR_JWT).
  PEAR_API_BASE_URL     Override Pear API host (default https://hl-v2.pearprotocol.io).
  PEAR_API_TIMEOUT_MS   Per-request timeout (default 10000).
  PEAR_CLIENT_ID        Client identifier (default APITRADER).

Docs: https://npmjs.com/package/@marvelcodes/mcp-pear
`);
}
