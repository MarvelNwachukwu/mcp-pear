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
	adjustmentType: z.enum(["REDUCE", "INCREASE"]),
	adjustmentSize: z.number().int().min(1).max(100),
	executionType: z.enum(["MARKET", "LIMIT"]),
	limitRatio: z.number().optional(),
	referralCode: z.string().optional(),
});

export const adjustPositionTool = {
	name: "adjust_position",
	description:
		"Reduce or increase an existing Pear Protocol position's size by 1-100 percent. executionType: MARKET (immediate) or LIMIT (provide limitRatio). WRITE: changes exposure on a real trade. Requires PEAR_TRADE_ENABLED=true.",
	parameters: inputSchema,
	execute: async (args: z.infer<typeof inputSchema>) => {
		try {
			getConfig().requireTradeEnabled("adjust_position");
			const { positionId, ...body } = args;
			const data = await PearClient.getInstance().adjustPosition(
				positionId,
				body,
			);
			const summary = `Adjusted position ${shortenId(positionId)}: ${args.adjustmentType} by ${args.adjustmentSize}% (${args.executionType}).`;
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
