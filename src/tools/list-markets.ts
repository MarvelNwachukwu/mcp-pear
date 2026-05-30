import { z } from "zod";
import { formatErrorMessage, renderResponse } from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({
	search: z
		.string()
		.optional()
		.describe(
			"Free-text search across market names (composition keys like `L:BTC|S:ETH`).",
		),
	engine: z.string().optional().describe("Filter by execution engine."),
	minVolume: z.number().optional().describe("Minimum 24h volume in USD."),
	change24h: z
		.number()
		.optional()
		.describe("Minimum 24h ratio change (e.g. 0.05 for +5%)."),
	netFunding: z.number().optional().describe("Filter by net funding rate."),
	sort: z
		.string()
		.optional()
		.describe("Sort key (e.g. 'volume', 'change24h')."),
	page: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Page number (1-indexed)."),
	pageSize: z
		.number()
		.int()
		.positive()
		.max(200)
		.optional()
		.describe("Results per page. Default 20."),
});

export const listMarketsTool = {
	name: "list_markets",
	description:
		"Browse Pear Protocol pair markets with optional filters and pagination. Each market is a long/short composition with current ratio, 24h change, volume, open interest, and funding. Use to discover what's tradable, or with searchText to find a specific pair.",
	parameters: inputSchema,
	execute: async (args: z.infer<typeof inputSchema>) => {
		try {
			const pageSize = args.pageSize ?? 20;
			const data = await PearClient.getInstance().listMarkets({
				...args,
				pageSize,
			});
			const top = [...data.markets]
				.sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0))
				.slice(0, 5)
				.map(
					(m) =>
						`• ${m.name}: ratio ${m.weightedRatio ?? m.ratio ?? "n/a"}, vol ${formatVol(m.volume)}`,
				)
				.join("\n");
			const summary = `Found ${data.total} markets (page ${data.page} of ${data.totalPages}). Top by volume on this page:\n${top}`;
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};

function formatVol(v: unknown): string {
	const n = typeof v === "number" ? v : Number(v ?? 0);
	if (!Number.isFinite(n)) return "n/a";
	if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
	return `$${n.toFixed(0)}`;
}
