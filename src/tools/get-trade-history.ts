import { z } from "zod";
import {
	formatErrorMessage,
	formatUsd,
	renderResponse,
} from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({
	limit: z
		.number()
		.int()
		.positive()
		.max(500)
		.optional()
		.describe("Max number of trades to return. Default 50."),
	startDate: z
		.string()
		.optional()
		.describe(
			"ISO 8601 timestamp or epoch ms. Only return trades on or after this time.",
		),
	endDate: z
		.string()
		.optional()
		.describe(
			"ISO 8601 timestamp or epoch ms. Only return trades on or before this time.",
		),
});

export const getTradeHistoryTool = {
	name: "get_trade_history",
	description:
		"Fetch the authenticated user's recent closed trades on Pear Protocol with realized PnL, entry/exit ratios, and pair composition. Optional date range and limit. Requires PEAR_API_KEY.",
	parameters: inputSchema,
	execute: async (args: z.infer<typeof inputSchema>) => {
		try {
			const limit = args.limit ?? 50;
			const trades = await PearClient.getInstance().getTradeHistory({
				limit,
				startDate: args.startDate,
				endDate: args.endDate,
			});
			const totalPnl = trades.reduce(
				(s, t) => s + (typeof t.realizedPnl === "number" ? t.realizedPnl : 0),
				0,
			);
			const summary =
				trades.length === 0
					? "No trades in the requested window."
					: `${trades.length} trade${trades.length === 1 ? "" : "s"} shown. Realized PnL sum: ${formatUsd(totalPnl)}.`;
			return renderResponse(summary, trades);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
