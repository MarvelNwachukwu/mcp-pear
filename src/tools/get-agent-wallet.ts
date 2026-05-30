import { z } from "zod";
import { formatErrorMessage, renderResponse } from "../lib/format.js";
import { PearClient } from "../services/pear-client.js";

const inputSchema = z.object({});

export const getAgentWalletTool = {
	name: "get_agent_wallet",
	description:
		"Get the authenticated user's Pear Protocol agent wallet address. The agent wallet is what Pear uses to sign Hyperliquid trades on the user's behalf. Returns an empty/missing address if no agent wallet has been created yet; call create_agent_wallet to create one.",
	parameters: inputSchema,
	execute: async () => {
		try {
			const data = await PearClient.getInstance().getAgentWallet();
			const summary = data.agentWalletAddress
				? `Agent wallet: ${data.agentWalletAddress}.`
				: "No agent wallet has been created for this account yet.";
			return renderResponse(summary, data);
		} catch (err) {
			return formatErrorMessage(err);
		}
	},
};
