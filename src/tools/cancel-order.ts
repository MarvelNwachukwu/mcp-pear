import { z } from "zod";
import { getConfig } from "../lib/config.js";
import {
	formatErrorMessage,
	renderResponse,
	shortenId,
} from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({
	orderId: z.string().min(1),
});

export const cancelOrderTool = {
	name: "cancel_order",
	description:
		"Cancel a pending Pear Protocol limit, take-profit, or stop-loss order by orderId. Does not affect already-filled portions. For TWAP orders, use cancel_twap_order. WRITE: cancels a live order. Requires PEAR_TRADE_ENABLED=true.",
	parameters: inputSchema,
	execute: async (args: z.infer<typeof inputSchema>) => {
		try {
			getConfig().requireTradeEnabled("cancel_order");
			const data = await PearClient.getInstance().cancelOrder(args.orderId);
			const summary = `Cancelled order ${shortenId(args.orderId)}.`;
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
