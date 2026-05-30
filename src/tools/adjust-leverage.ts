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
	leverage: z.number().int().min(1).max(100),
});

export const adjustLeverageTool = {
	name: "adjust_leverage",
	description:
		"Change leverage (1-100x) on an existing Pear Protocol position. Higher leverage means greater liquidation risk for the same price move. WRITE: changes risk profile of a live position. Requires PEAR_TRADE_ENABLED=true.",
	parameters: inputSchema,
	execute: async (args: z.infer<typeof inputSchema>) => {
		try {
			getConfig().requireTradeEnabled("adjust_leverage");
			const data = await PearClient.getInstance().adjustLeverage(
				args.positionId,
				args.leverage,
			);
			const summary = `Set leverage on position ${shortenId(args.positionId)} to ${args.leverage}x.`;
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
