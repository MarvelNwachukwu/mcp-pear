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

export const cancelTwapOrderTool = {
	name: "cancel_twap_order",
	description:
		"Cancel a Pear Protocol TWAP (time-weighted average price) order and all of its remaining unfilled chunks. WRITE: cancels a live order. Requires PEAR_TRADE_ENABLED=true.",
	parameters: inputSchema,
	execute: async (args: z.infer<typeof inputSchema>) => {
		try {
			getConfig().requireTradeEnabled("cancel_twap_order");
			const data = await PearClient.getInstance().cancelTwapOrder(args.orderId);
			const summary = `Cancelled TWAP order ${shortenId(args.orderId)} (and any remaining chunks).`;
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
