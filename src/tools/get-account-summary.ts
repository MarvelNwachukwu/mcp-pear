import { z } from "zod";
import {
	formatErrorMessage,
	formatUsd,
	renderResponse,
} from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({});

export const getAccountSummaryTool = {
	name: "get_account_summary",
	description:
		"Get the authenticated user's Pear Protocol account summary: agent wallet address, total closed trades, pending trigger-order USD value, pending TWAP-chunk USD value, and last sync timestamp. Requires PEAR_API_KEY.",
	parameters: inputSchema,
	execute: async () => {
		try {
			const data = await PearClient.getInstance().getAccountSummary();
			const summary = [
				`Account ${data.agentWalletAddress.slice(0, 6)}…${data.agentWalletAddress.slice(-4)}.`,
				`Closed trades: ${data.totalClosedTrades}.`,
				data.totalTriggerOrderUsdValue !== undefined
					? `Pending trigger orders: ${formatUsd(data.totalTriggerOrderUsdValue)}.`
					: undefined,
				data.totalTwapChunkUsdValue !== undefined
					? `Pending TWAP chunks: ${formatUsd(data.totalTwapChunkUsdValue)}.`
					: undefined,
				data.lastSyncedAt
					? `Last synced: ${new Date(data.lastSyncedAt).toISOString()}.`
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
