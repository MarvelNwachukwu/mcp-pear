import { z } from "zod";
import {
	formatErrorMessage,
	formatPct,
	renderResponse,
} from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";
import type { Market } from "../types.js";

const inputSchema = z.object({
	longAssets: z
		.array(z.string().min(1))
		.min(1)
		.describe("Asset symbols on the long side (e.g. ['BTC'])."),
	shortAssets: z
		.array(z.string().min(1))
		.describe(
			"Asset symbols on the short side. Pass an empty array for long-only baskets.",
		),
});

export function buildSearchKey(
	longAssets: string[],
	shortAssets: string[],
): string[] {
	const candidates: string[] = [];
	const original = `L:${longAssets.join(",")}|S:${shortAssets.join(",")}`;
	candidates.push(original);
	const sortedLong = [...longAssets].sort();
	const sortedShort = [...shortAssets].sort();
	const sorted = `L:${sortedLong.join(",")}|S:${sortedShort.join(",")}`;
	if (sorted !== original) candidates.push(sorted);
	return candidates;
}

export function findExactMatch(
	markets: Market[],
	keys: string[],
): Market | null {
	for (const key of keys) {
		const found = markets.find((m) => m.name === key);
		if (found) return found;
	}
	return null;
}

export const getPairRatioTool = {
	name: "get_pair_ratio",
	description:
		"Get the current ratio (long/short composition price) for a specific Pear Protocol pair. Pass long and short asset arrays. Returns the ratio, 24h change, and funding rate. Useful when you know the pair you care about and want the latest number.",
	parameters: inputSchema,
	execute: async (args: z.infer<typeof inputSchema>) => {
		try {
			const candidates = buildSearchKey(args.longAssets, args.shortAssets);
			const search = candidates[0];
			const result = await PearClient.getInstance().listMarkets({
				search,
				pageSize: 50,
			});
			const match = findExactMatch(result.markets, candidates);
			if (!match) {
				const close = result.markets
					.slice(0, 5)
					.map((m) => `• ${m.name}`)
					.join("\n");
				return `No exact match for ${candidates[0]}.${close ? `\n\nClose matches found:\n${close}` : ""}`;
			}
			const change = Number(match.weightedChange24h ?? match.change24h ?? 0);
			const ratio = match.weightedRatio ?? match.ratio;
			const funding = Number(match.netFunding ?? 0);
			const summary = `${match.name} ratio: ${ratio ?? "n/a"} (${formatPct(change)} 24h). Funding: ${formatPct(funding)}.`;
			return renderResponse(summary, match);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
