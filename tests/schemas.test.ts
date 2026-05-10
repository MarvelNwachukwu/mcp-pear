import { describe, expect, it } from "vitest";
import { AccountSummarySchema } from "../src/types.js";

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
