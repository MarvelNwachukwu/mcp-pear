import { z } from "zod";
import { formatErrorMessage, renderResponse } from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({});

export const getTwapOrdersTool = {
	name: "get_twap_orders",
	description:
		"List the authenticated user's active TWAP (time-weighted average price) orders on Pear Protocol, including chunk execution and fill detail. Requires PEAR_API_KEY.",
	parameters: inputSchema,
	execute: async () => {
		try {
			const orders = await PearClient.getInstance().getTwapOrders();
			const summary =
				orders.length === 0
					? "No active TWAP orders."
					: `${orders.length} active TWAP order${orders.length === 1 ? "" : "s"}.`;
			return renderResponse(summary, orders);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
