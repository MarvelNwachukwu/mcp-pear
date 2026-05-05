import { z } from "zod";
import {
	formatErrorMessage,
	formatUsd,
	renderResponse,
} from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({});

export const getPortfolioTool = {
	name: "get_portfolio",
	description:
		"Fetch the authenticated user's full portfolio metrics on Pear Protocol: bucketed PnL across last 1 day / 1 week / 1 month / 1 year / all-time, plus overall stats (total trades, all-time volume, current open interest, unrealized PnL). Requires PEAR_API_KEY.",
	parameters: inputSchema,
	execute: async () => {
		try {
			const data = await PearClient.getInstance().getPortfolio();
			const overall = data.overall ?? {};
			const oneWeek = data.oneWeek ?? {};
			const oneMonth = data.oneMonth ?? {};
			const summary = [
				`Overall: ${overall.totalTradeCount ?? 0} trades, ${formatUsd(overall.allTimeVolume ?? 0)} all-time volume.`,
				`Unrealized PnL: ${formatUsd(overall.unrealizedPnl ?? 0)}.`,
				`Last 7d volume: ${formatUsd(oneWeek.volumeUsd ?? 0)}.`,
				`Last 30d volume: ${formatUsd(oneMonth.volumeUsd ?? 0)}.`,
			].join(" ");
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
