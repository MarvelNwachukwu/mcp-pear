/**
 * Parameterized coverage for v0.2 write tools.
 *
 * Two invariants per write tool:
 *   1. With PEAR_TRADE_ENABLED unset, .execute() returns the gate-error
 *      string and DOES NOT hit the network.
 *   2. With PEAR_TRADE_ENABLED=true, .execute() makes the network call
 *      and returns a renderResponse-shaped string containing the summary.
 *
 * The two read tools (get_agent_wallet plus the existing v0.1 reads)
 * have their network behavior covered by pear-client tests; here we just
 * confirm get_agent_wallet is wired without a gate.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "../src/lib/config.js";
import { PearClient } from "../src/services/pear-client.js";
import * as tools from "../src/tools/index.js";

const fetchMock = vi.fn();
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
	process.env = { ...ORIGINAL_ENV, PEAR_JWT: "test-jwt" };
	process.env.PEAR_API_KEY = undefined;
	process.env.PEAR_ADDRESS = undefined;
	process.env.PEAR_REFRESH_TOKEN = undefined;
	process.env.PEAR_TRADE_ENABLED = undefined;
	resetConfigForTests();
	PearClient.resetForTests();
});
afterEach(() => {
	vi.unstubAllGlobals();
	process.env = ORIGINAL_ENV;
	resetConfigForTests();
	PearClient.resetForTests();
});

describe("get_agent_wallet (no gate)", () => {
	it("returns the address when set", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ agentWalletAddress: "0xagent" }),
		});
		const out = await tools.getAgentWalletTool.execute({});
		expect(out).toContain("0xagent");
	});

	it("explains when no agent wallet exists yet", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ agentWalletAddress: "" }),
		});
		const out = await tools.getAgentWalletTool.execute({});
		expect(out).toContain("No agent wallet has been created");
	});
});

interface WriteToolCase {
	name: string;
	tool: { execute: (args: unknown) => Promise<string> };
	args: unknown;
	mockResponse: unknown;
	mockStatus?: number;
	expectInSummary: RegExp;
}

const WRITE_CASES: WriteToolCase[] = [
	{
		name: "create_agent_wallet",
		tool: tools.createAgentWalletTool,
		args: {},
		mockResponse: {
			agentWalletAddress: "0xnew",
			message: "Approve on Hyperliquid",
		},
		mockStatus: 201,
		expectInSummary: /Created agent wallet 0xnew/,
	},
	{
		name: "open_position",
		tool: tools.openPositionTool,
		args: {
			executionType: "MARKET",
			leverage: 10,
			usdValue: 100,
			slippage: 0.005,
			longAssets: [{ asset: "BTC", weight: 1 }],
			shortAssets: [{ asset: "ETH", weight: 1 }],
		},
		mockResponse: { orderId: "ord_abcdef123456", fills: [] },
		mockStatus: 201,
		expectInSummary: /Opened MARKET position \(10x, \$100\)/,
	},
	{
		name: "close_position",
		tool: tools.closePositionTool,
		args: { positionId: "pos_abc", executionType: "MARKET" },
		mockResponse: { orderId: "ord_xyz" },
		expectInSummary: /Closed position pos_abc/,
	},
	{
		name: "close_all_positions",
		tool: tools.closeAllPositionsTool,
		args: { executionType: "MARKET" },
		mockResponse: {
			results: [
				{ positionId: "p1", success: true, orderId: "o1" },
				{ positionId: "p2", success: false, error: "no margin" },
			],
		},
		expectInSummary: /Closed 1\/2 positions/,
	},
	{
		name: "adjust_position",
		tool: tools.adjustPositionTool,
		args: {
			positionId: "pos_abc",
			adjustmentType: "REDUCE",
			adjustmentSize: 25,
			executionType: "MARKET",
		},
		mockResponse: { orderId: "ord_x" },
		expectInSummary: /REDUCE by 25%/,
	},
	{
		name: "adjust_leverage",
		tool: tools.adjustLeverageTool,
		args: { positionId: "pos_abc", leverage: 50 },
		mockResponse: { ok: true },
		expectInSummary: /leverage on position pos_abc to 50x/,
	},
	{
		name: "set_risk_parameters",
		tool: tools.setRiskParametersTool,
		args: {
			positionId: "pos_abc",
			stopLoss: { type: "PRICE", value: 95 },
		},
		mockResponse: { positionId: "pos_abc" },
		expectInSummary: /Updated TP\/SL on position pos_abc/,
	},
	{
		name: "cancel_order",
		tool: tools.cancelOrderTool,
		args: { orderId: "ord_abc" },
		mockResponse: { orderId: "ord_abc", status: "cancelled" },
		expectInSummary: /Cancelled order ord_abc/,
	},
	{
		name: "cancel_twap_order",
		tool: tools.cancelTwapOrderTool,
		args: { orderId: "ord_abc" },
		mockResponse: { orderId: "ord_abc", status: "cancelled" },
		expectInSummary: /Cancelled TWAP order ord_abc/,
	},
];

describe.each(WRITE_CASES)("$name (gated)", (c) => {
	it("returns the gate error when PEAR_TRADE_ENABLED is unset", async () => {
		const out = await c.tool.execute(c.args);
		expect(out).toMatch(/PEAR_TRADE_ENABLED=true/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("executes and returns a summary when enabled", async () => {
		process.env.PEAR_TRADE_ENABLED = "true";
		resetConfigForTests();
		fetchMock.mockResolvedValue({
			ok: true,
			status: c.mockStatus ?? 200,
			json: async () => c.mockResponse,
		});
		const out = await c.tool.execute(c.args);
		expect(out).toMatch(c.expectInSummary);
		expect(fetchMock).toHaveBeenCalledOnce();
	});
});
