import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "../src/lib/config.js";
import { PearClient } from "../src/services/pear-client.js";

const fetchMock = vi.fn();
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
	process.env = { ...ORIGINAL_ENV, PEAR_JWT: "test-jwt" };
	process.env.PEAR_API_KEY = undefined;
	process.env.PEAR_ADDRESS = undefined;
	process.env.PEAR_REFRESH_TOKEN = undefined;
	resetConfigForTests();
	PearClient.resetForTests();
});
afterEach(() => {
	vi.unstubAllGlobals();
	process.env = ORIGINAL_ENV;
	resetConfigForTests();
	PearClient.resetForTests();
});

describe("getAgentWallet", () => {
	it("GETs /agentWallet and returns address", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ agentWalletAddress: "0xagent" }),
		});
		const result = await PearClient.getInstance().getAgentWallet();
		expect(result.agentWalletAddress).toBe("0xagent");
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toContain("/agentWallet");
		expect(init.method).toBe("GET");
	});
});

describe("createAgentWallet", () => {
	it("POSTs /agentWallet and returns address + message", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 201,
			json: async () => ({
				agentWalletAddress: "0xnew",
				message: "Approve on Hyperliquid",
			}),
		});
		const result = await PearClient.getInstance().createAgentWallet();
		expect(result.agentWalletAddress).toBe("0xnew");
		expect(result.message).toMatch(/Approve/);
		const [, init] = fetchMock.mock.calls[0];
		expect(init.method).toBe("POST");
	});
});

describe("createPosition", () => {
	it("POSTs /positions with the full body", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 201,
			json: async () => ({ orderId: "ord_123", fills: [] }),
		});
		const result = await PearClient.getInstance().createPosition({
			executionType: "MARKET",
			leverage: 10,
			usdValue: 100,
			slippage: 0.005,
			longAssets: [{ asset: "BTC", weight: 1 }],
			shortAssets: [{ asset: "ETH", weight: 1 }],
		});
		expect(result.orderId).toBe("ord_123");
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toContain("/positions");
		expect(init.method).toBe("POST");
		const body = JSON.parse(init.body);
		expect(body.executionType).toBe("MARKET");
		expect(body.leverage).toBe(10);
		expect(body.usdValue).toBe(100);
	});
});

describe("closePosition", () => {
	it("POSTs /positions/{id}/close with body", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ orderId: "ord_x" }),
		});
		const result = await PearClient.getInstance().closePosition("pos_abc", {
			executionType: "MARKET",
		});
		expect(result.orderId).toBe("ord_x");
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toContain("/positions/pos_abc/close");
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body).executionType).toBe("MARKET");
	});

	it("URL-encodes positionId", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ orderId: "x" }),
		});
		await PearClient.getInstance().closePosition("pos/with/slashes", {
			executionType: "MARKET",
		});
		const [url] = fetchMock.mock.calls[0];
		expect(url).toContain("pos%2Fwith%2Fslashes");
	});
});

describe("closeAllPositions", () => {
	it("POSTs /positions/close-all", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				results: [{ positionId: "p1", success: true, orderId: "o1" }],
			}),
		});
		const result = await PearClient.getInstance().closeAllPositions({
			executionType: "MARKET",
		});
		expect(result.results).toHaveLength(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toContain("/positions/close-all");
		expect(init.method).toBe("POST");
	});
});

describe("adjustPosition", () => {
	it("POSTs /positions/{id}/adjust", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ orderId: "o", status: "ok" }),
		});
		await PearClient.getInstance().adjustPosition("p1", {
			adjustmentType: "REDUCE",
			adjustmentSize: 25,
			executionType: "MARKET",
		});
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toContain("/positions/p1/adjust");
		expect(init.method).toBe("POST");
		const body = JSON.parse(init.body);
		expect(body.adjustmentType).toBe("REDUCE");
		expect(body.adjustmentSize).toBe(25);
	});
});

describe("adjustLeverage", () => {
	it("POSTs /positions/{id}/adjust-leverage with { leverage }", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({}),
		});
		await PearClient.getInstance().adjustLeverage("p1", 50);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toContain("/positions/p1/adjust-leverage");
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body)).toEqual({ leverage: 50 });
	});
});

describe("setRiskParameters", () => {
	it("PUTs /positions/{id}/riskParameters", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ positionId: "p1" }),
		});
		await PearClient.getInstance().setRiskParameters("p1", {
			stopLoss: { type: "PRICE", value: 95 },
			takeProfit: { type: "PERCENTAGE", value: 10 },
		});
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toContain("/positions/p1/riskParameters");
		expect(init.method).toBe("PUT");
		const body = JSON.parse(init.body);
		expect(body.stopLoss.value).toBe(95);
	});
});

describe("cancelOrder", () => {
	it("DELETEs /orders/{id}/cancel", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ orderId: "o1", status: "cancelled" }),
		});
		const result = await PearClient.getInstance().cancelOrder("o1");
		expect(result.status).toBe("cancelled");
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toContain("/orders/o1/cancel");
		expect(init.method).toBe("DELETE");
	});
});

describe("cancelTwapOrder", () => {
	it("POSTs /orders/{id}/twap/cancel", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ orderId: "o1", status: "cancelled" }),
		});
		await PearClient.getInstance().cancelTwapOrder("o1");
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toContain("/orders/o1/twap/cancel");
		expect(init.method).toBe("POST");
	});
});
