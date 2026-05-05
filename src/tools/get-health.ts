import { z } from "zod";
import { formatErrorMessage, renderResponse } from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({});

export const getHealthTool = {
	name: "get_health",
	description:
		"Check Pear Protocol API health. Returns service status, server timestamp, and uptime in seconds. Use this to verify the API is reachable before running other tools.",
	parameters: inputSchema,
	execute: async () => {
		try {
			const data = await PearClient.getInstance().getHealth();
			const summary = `Pear API healthy. Status: ${data.status}. Uptime: ${Math.round(data.uptime)}s.`;
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
