import { z } from "zod";
import { formatErrorMessage, renderResponse } from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({});

export const getOpenOrdersTool = {
	name: "get_open_orders",
	description:
		"List the authenticated user's open limit, take-profit, and stop-loss orders on Pear Protocol. Returns each order's ID, type, status, and pair composition. Requires PEAR_API_KEY.",
	parameters: inputSchema,
	execute: async () => {
		try {
			const orders = await PearClient.getInstance().getOpenOrders();
			const summary =
				orders.length === 0
					? "No open orders."
					: `${orders.length} open order${orders.length === 1 ? "" : "s"}.`;
			return renderResponse(summary, orders);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
