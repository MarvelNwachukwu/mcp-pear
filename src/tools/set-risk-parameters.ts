import { z } from "zod";
import { getConfig } from "../lib/config.js";
import {
	formatErrorMessage,
	renderResponse,
	shortenId,
} from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";
import { TpSlThresholdSchema } from "../types.js";

const inputSchema = z.object({
	positionId: z.string().min(1),
	stopLoss: TpSlThresholdSchema.nullable().optional(),
	takeProfit: TpSlThresholdSchema.nullable().optional(),
});

export const setRiskParametersTool = {
	name: "set_risk_parameters",
	description:
		"Set or update stop-loss / take-profit on an existing Pear Protocol position. Each threshold has type ('PRICE' or 'PERCENTAGE'), value, and optional trailing fields. Pass null to clear a field; omit it to leave unchanged. WRITE: changes risk parameters on a live position. Requires PEAR_TRADE_ENABLED=true.",
	parameters: inputSchema,
	execute: async (args: z.infer<typeof inputSchema>) => {
		try {
			getConfig().requireTradeEnabled("set_risk_parameters");
			const { positionId, ...body } = args;
			const data = await PearClient.getInstance().setRiskParameters(
				positionId,
				body,
			);
			const summary = `Updated TP/SL on position ${shortenId(positionId)}.`;
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
