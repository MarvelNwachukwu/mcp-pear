// Example: integrating mcp-pear into a Telegram bot or other multi-tenant orchestrator.
//
// The orchestrator owns user authentication (e.g. via Pear's onboarding wizard at
// app.pear.garden/connect/telegram?code=<code>, or any custom EIP-712/Privy/wallet flow)
// and stores per-user JWTs in its database. When the bot needs to call a Pear API on
// behalf of a user, it spawns mcp-pear as a subprocess with the user's JWT injected via
// PEAR_JWT — mcp-pear treats the JWT as opaque and never touches /auth/login.
//
// This example is illustrative; the actual MCP client integration depends on your stack
// (FastMCP client, raw stdio JSON-RPC, ADK-TS McpToolset, etc.).

import { spawn } from "node:child_process";

interface UserCredentials {
	userId: string;
	pearJwt: string;
	pearRefreshToken?: string;
}

/**
 * Spawns an mcp-pear subprocess with the given user's JWT pre-loaded.
 * The bot is responsible for minting/refreshing JWTs out-of-band; mcp-pear is just
 * a credential consumer in this mode.
 */
export function spawnMcpPearForUser(creds: UserCredentials) {
	const child = spawn("npx", ["-y", "@marvelcodes/mcp-pear"], {
		stdio: ["pipe", "pipe", "inherit"],
		env: {
			...process.env,
			PEAR_JWT: creds.pearJwt,
			...(creds.pearRefreshToken
				? { PEAR_REFRESH_TOKEN: creds.pearRefreshToken }
				: {}),
		},
	});
	return child;
}

// Example usage (pseudocode — your bot framework drives the MCP client):
//
//   const user = await db.users.findOne({ telegramId: ctx.from.id });
//   const child = spawnMcpPearForUser({
//     userId: user.id,
//     pearJwt: user.pearJwt,
//     pearRefreshToken: user.pearRefreshToken,
//   });
//   const mcpClient = new McpClient(child.stdin, child.stdout);
//   const result = await mcpClient.callTool("get_portfolio", {});
//   await ctx.reply(result.content[0].text);
//
// When PEAR_JWT expires:
//   - If PEAR_REFRESH_TOKEN was provided, mcp-pear self-refreshes (rotating the token) and continues.
//   - Otherwise mcp-pear surfaces "JWT expired; the orchestrator must mint a new one
//     and restart mcp-pear." — your bot intercepts this, refreshes the user's JWT
//     via Pear's auth flow, and respawns the subprocess.
