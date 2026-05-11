import { z } from "zod";
import { getConfig } from "../lib/config.js";
import { formatErrorMessage, renderResponse } from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({
	executionType: z.enum(["MARKET", "TWAP"]),
	twapDuration: z.number().optional(),
	twapIntervalSeconds: z.number().optional(),
	randomizeExecution: z.boolean().optional(),
	referralCode: z.string().optional(),
});

export const closeAllPositionsTool = {
	name: "close_all_positions",
	description:
		"Close every open Pear Protocol position with a single executionType (MARKET or TWAP). Returns a per-position result array with success/error. WRITE: executes real trades. Requires PEAR_TRADE_ENABLED=true.",
	parameters: inputSchema,
	execute: async (args: z.infer<typeof inputSchema>) => {
		try {
			getConfig().requireTradeEnabled("close_all_positions");
			const data = await PearClient.getInstance().closeAllPositions(args);
			const successCount = data.results.filter((r) => r.success).length;
			const summary = `Closed ${successCount}/${data.results.length} positions (${args.executionType}).`;
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
