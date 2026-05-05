import { z } from "zod";
import {
	formatErrorMessage,
	formatUsd,
	renderResponse,
} from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({});

export const getOpenPositionsTool = {
	name: "get_open_positions",
	description:
		"List the authenticated user's currently open Pear Protocol pair positions, including position ID, entry ratio, mark ratio, unrealized PnL, and long/short composition. Requires PEAR_API_KEY.",
	parameters: inputSchema,
	execute: async () => {
		try {
			const positions = await PearClient.getInstance().getOpenPositions();
			const totalPnl = positions.reduce(
				(sum, p) =>
					sum + (typeof p.unrealizedPnl === "number" ? p.unrealizedPnl : 0),
				0,
			);
			const lines = positions
				.slice(0, 5)
				.map(
					(p) =>
						`• ${p.positionId.slice(0, 8)}… entry ${p.entryRatio ?? "n/a"} → mark ${p.markRatio ?? "n/a"}, PnL ${formatUsd(p.unrealizedPnl ?? 0)}`,
				)
				.join("\n");
			const summary =
				positions.length === 0
					? "No open positions."
					: `${positions.length} open positions. Total unrealized PnL: ${formatUsd(totalPnl)}.${lines ? `\n${lines}` : ""}`;
			return renderResponse(summary, positions);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
