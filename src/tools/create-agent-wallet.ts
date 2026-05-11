import { z } from "zod";
import { getConfig } from "../lib/config.js";
import { formatErrorMessage, renderResponse } from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({});

export const createAgentWalletTool = {
	name: "create_agent_wallet",
	description:
		"Create a new Pear Protocol agent wallet for the authenticated user. The agent wallet is what Pear uses to sign Hyperliquid trades. After creation, the user MUST approve this wallet on Hyperliquid (the response message contains the approval instructions). WRITE: executes a state change. Requires PEAR_TRADE_ENABLED=true.",
	parameters: inputSchema,
	execute: async () => {
		try {
			getConfig().requireTradeEnabled("create_agent_wallet");
			const data = await PearClient.getInstance().createAgentWallet();
			const summary = `Created agent wallet ${data.agentWalletAddress}.${data.message ? ` ${data.message}` : ""}`;
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
