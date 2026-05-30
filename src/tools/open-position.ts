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
	executionType: z.enum([
		"SYNC",
		"MARKET",
		"TRIGGER",
		"TWAP",
		"LADDER",
		"TP",
		"SL",
	]),
	leverage: z.number().int().min(1).max(100),
	usdValue: z.number().min(1),
	slippage: z.number().min(0.001).max(0.1),
	longAssets: z
		.array(z.object({ asset: z.string(), weight: z.number() }))
		.min(1),
	shortAssets: z.array(z.object({ asset: z.string(), weight: z.number() })),
	triggerValue: z.number().optional(),
	triggerType: z.enum(["ABOVE", "BELOW"]).optional(),
	direction: z.enum(["LONG", "SHORT"]).optional(),
	twapDuration: z.number().optional(),
	twapIntervalSeconds: z.number().optional(),
	randomizeExecution: z.boolean().optional(),
	ladderConfig: z.record(z.unknown()).optional(),
	stopLoss: TpSlThresholdSchema.nullable().optional(),
	takeProfit: TpSlThresholdSchema.nullable().optional(),
	referralCode: z.string().optional(),
});

export const openPositionTool = {
	name: "open_position",
	description:
		"Open a new pair position on Pear Protocol. Specify executionType (MARKET / TRIGGER / TWAP / LADDER / TP / SL / SYNC), leverage (1-100), usdValue (≥1), slippage (0.001-0.1), and the long/short asset compositions (arrays of { asset, weight }). Optionally attach stopLoss/takeProfit and TWAP/TRIGGER/LADDER parameters. WRITE: executes a real trade. Requires PEAR_TRADE_ENABLED=true.",
	parameters: inputSchema,
	execute: async (args: z.infer<typeof inputSchema>) => {
		try {
			getConfig().requireTradeEnabled("open_position");
			const data = await PearClient.getInstance().createPosition(args);
			const summary = `Opened ${args.executionType} position (${args.leverage}x, $${args.usdValue}). Order id: ${shortenId(data.orderId)}.`;
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
