import { describe, expect, it } from "vitest";
import { buildSearchKey, findExactMatch } from "../src/tools/get-pair-ratio.js";
import type { Market } from "../src/types.js";

describe("buildSearchKey", () => {
	it("composes simple long-only keys", () => {
		expect(buildSearchKey(["BTC"], [])).toEqual(["L:BTC|S:"]);
	});
	it("composes long+short keys", () => {
		expect(buildSearchKey(["BTC"], ["ETH"])).toEqual(["L:BTC|S:ETH"]);
	});
	it("composes multi-asset keys preserving order", () => {
		expect(buildSearchKey(["BTC", "HYPE"], ["ETH"])).toEqual([
			"L:BTC,HYPE|S:ETH",
		]);
	});
	it("also returns sorted variant when input order differs from sorted", () => {
		const result = buildSearchKey(["HYPE", "BTC"], ["ETH"]);
		expect(result).toContain("L:HYPE,BTC|S:ETH");
		expect(result).toContain("L:BTC,HYPE|S:ETH");
	});
});

describe("findExactMatch", () => {
	const markets: Market[] = [
		{ name: "L:BTC|S:ETH", ratio: 1.5 },
		{ name: "L:BTC,HYPE|S:ETH", ratio: 2.5 },
		{ name: "L:ETH|S:BTC", ratio: 0.66 },
	];

	it("returns the row matching the candidate key", () => {
		const match = findExactMatch(markets, ["L:BTC|S:ETH"]);
		expect(match?.ratio).toBe(1.5);
	});

	it("returns null when no candidate matches", () => {
		expect(findExactMatch(markets, ["L:DOGE|S:SOL"])).toBeNull();
	});

	it("tries multiple candidates and returns the first match", () => {
		const match = findExactMatch(markets, ["L:DOGE|S:SOL", "L:BTC,HYPE|S:ETH"]);
		expect(match?.ratio).toBe(2.5);
	});
});
