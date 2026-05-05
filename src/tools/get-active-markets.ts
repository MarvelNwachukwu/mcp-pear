import { z } from "zod";
import {
	formatErrorMessage,
	formatPct,
	renderResponse,
} from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({});

export const getActiveMarketsTool = {
	name: "get_active_markets",
	description:
		"Get the most active Pear Protocol pair markets right now: current active pairs plus top gainers, top losers, highlighted pairs, and the user's watchlist. Use to see what's hot or as a starting point for narrowing into a specific pair.",
	parameters: inputSchema,
	execute: async () => {
		try {
			const data = await PearClient.getInstance().getActiveMarkets();
			const topGainer = data.topGainers?.[0];
			const topLoser = data.topLosers?.[0];
			const summary = [
				`Active: ${data.active.length} pairs.`,
				topGainer
					? `Top gainer: ${topGainer.key} (${formatPct(Number(topGainer.weightedChange24h ?? topGainer.change24h ?? 0))}).`
					: undefined,
				topLoser
					? `Top loser: ${topLoser.key} (${formatPct(Number(topLoser.weightedChange24h ?? topLoser.change24h ?? 0))}).`
					: undefined,
			]
				.filter(Boolean)
				.join(" ");
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
