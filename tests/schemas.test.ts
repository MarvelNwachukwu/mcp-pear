import { describe, expect, it } from "vitest";
import {
	AccountSummarySchema,
	ApiKeyResponseSchema,
	AuthMessageSchema,
} from "../src/types.js";

describe("AccountSummarySchema", () => {
	it("accepts stringified epoch ms in lastSyncedAt and coerces to number", () => {
		// Shape observed live from GET /accounts on 2026-05-10.
		const live = {
			agentWalletAddress: "0xE06041F2aC21F31bdccE868638E815457d88A026",
			totalTwapChunkUsdValue: 0,
			totalTriggerOrderUsdValue: 0,
			totalClosedTrades: 17,
			lastSyncedAt: "1772760462927",
		};
		const parsed = AccountSummarySchema.parse(live);
		expect(parsed.lastSyncedAt).toBe(1772760462927);
		expect(typeof parsed.lastSyncedAt).toBe("number");
		expect(new Date(parsed.lastSyncedAt as number).toISOString()).toBe(
			"2026-03-06T01:27:42.927Z",
		);
	});

	it("still accepts a numeric lastSyncedAt", () => {
		const parsed = AccountSummarySchema.parse({
			agentWalletAddress: "0xabc",
			totalClosedTrades: 0,
			lastSyncedAt: 1772760462927,
		});
		expect(parsed.lastSyncedAt).toBe(1772760462927);
	});

	it("permits an omitted lastSyncedAt", () => {
		const parsed = AccountSummarySchema.parse({
			agentWalletAddress: "0xabc",
			totalClosedTrades: 0,
		});
		expect(parsed.lastSyncedAt).toBeUndefined();
	});
});

describe("AuthMessageSchema", () => {
	it("parses a representative /auth/eip712-message response", () => {
		const live = {
			domain: {
				name: "PearProtocol",
				version: "1",
				chainId: 998,
				verifyingContract: "0x1234567890123456789012345678901234567890",
			},
			types: {
				EIP712Domain: [
					{ name: "name", type: "string" },
					{ name: "version", type: "string" },
					{ name: "chainId", type: "uint256" },
					{ name: "verifyingContract", type: "address" },
				],
				Login: [
					{ name: "address", type: "address" },
					{ name: "nonce", type: "uint256" },
					{ name: "expiresAt", type: "uint256" },
				],
			},
			primaryType: "Login",
			message: {
				address: "0xeb6E3C2522b78bb0a5c65198eB35566b43171137",
				nonce: "12345",
				expiresAt: "1780000000",
			},
		};
		const parsed = AuthMessageSchema.parse(live);
		expect(parsed.primaryType).toBe("Login");
		expect(parsed.message.address).toBe(live.message.address);
	});

	it("accepts arbitrary extra fields in domain (forward-compatible)", () => {
		const live = {
			domain: { name: "X", version: "1", chainId: 1, salt: "0xdead" },
			types: { EIP712Domain: [{ name: "name", type: "string" }], M: [] },
			primaryType: "M",
			message: {},
		};
		expect(() => AuthMessageSchema.parse(live)).not.toThrow();
	});
});

describe("ApiKeyResponseSchema", () => {
	it("parses a representative POST /api-keys response", () => {
		const live = {
			id: "ak_2yT4xQ",
			apiKey: "pk_live_abc123def456",
			name: "mcp-pear-marvel-mbp-2026-05-11",
			createdAt: "2026-05-11T10:00:00.000Z",
		};
		const parsed = ApiKeyResponseSchema.parse(live);
		expect(parsed.id).toBe("ak_2yT4xQ");
		expect(parsed.apiKey).toBe("pk_live_abc123def456");
	});

	it("permits createdAt as numeric string or number or absent", () => {
		const a = ApiKeyResponseSchema.parse({
			id: "x",
			apiKey: "y",
			name: "z",
			createdAt: "1772760462927",
		});
		expect(typeof a.createdAt).toBe("string");
		const b = ApiKeyResponseSchema.parse({ id: "x", apiKey: "y" });
		expect(b.createdAt).toBeUndefined();
	});
});
