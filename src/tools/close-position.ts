import { z } from "zod";
import { getConfig } from "../lib/config.js";
import {
	formatErrorMessage,
	renderResponse,
	shortenId,
} from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({
	positionId: z.string().min(1),
	executionType: z.enum(["MARKET", "TWAP"]),
	twapDuration: z.number().optional(),
	twapIntervalSeconds: z.number().optional(),
	randomizeExecution: z.boolean().optional(),
	referralCode: z.string().optional(),
});

export const closePositionTool = {
	name: "close_position",
	description:
		"Close one open Pear Protocol position by positionId. executionType: MARKET (immediate) or TWAP (spread over time — requires twapDuration in seconds). WRITE: executes a real trade. Requires PEAR_TRADE_ENABLED=true.",
	parameters: inputSchema,
	execute: async (args: z.infer<typeof inputSchema>) => {
		try {
			getConfig().requireTradeEnabled("close_position");
			const { positionId, ...body } = args;
			const data = await PearClient.getInstance().closePosition(
				positionId,
				body,
			);
			const summary = `Closed position ${shortenId(positionId)} (${args.executionType}). Order id: ${shortenId(data.orderId)}.`;
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
