import { spawn } from "node:child_process";
import { hostname, tmpdir } from "node:os";
import { cwd, env, exit, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { getConfig, resetConfigForTests } from "../lib/config.js";
import { SignatureMismatchError, recoverEip712Signer } from "../lib/eip712.js";
import { HttpError } from "../lib/http.js";
import {
	getEip712Message,
	mintApiKey,
	mintJwtEip712,
} from "../services/auth.js";
import { PearClient } from "../services/pear-client.js";
import { envFileStatus, writeEnvVars } from "./env-writer.js";
import {
	askAddress,
	askSignature,
	askTokenName,
	askYesNo,
	defaultTokenName,
} from "./prompts.js";
import { writeSignerPage } from "./signer-page.js";

export async function runSetup(): Promise<void> {
	const rl = createInterface({ input: stdin, output: stdout });
	try {
		console.log(
			"mcp-pear setup — mint a Pear Protocol API key for your wallet.\n",
		);

		const cfg = getConfig();
		const baseUrl = cfg.baseUrl;
		const clientId = cfg.clientId;
		const timeoutMs = cfg.timeoutMs;

		const address = await askAddress(rl);
		const tokenName = await askTokenName(
			rl,
			defaultTokenName({ hostname: hostname(), now: new Date() }),
		);

		console.log("\nStep 1/4 — fetching sign-in message from Pear…");
		const typedData = await getEip712Message({ address, baseUrl, timeoutMs });
		console.log("  ✓ EIP-712 typed data received");

		console.log("\nStep 2/4 — sign in your wallet");
		const { fileUrl } = await writeSignerPage({
			outDir: tmpdir(),
			address,
			typedData,
		});
		console.log(`  Opening ${fileUrl}`);
		console.log("  (If your browser didn't open it, click the link above.)\n");
		openBrowser(fileUrl);

		let signature: string;
		while (true) {
			signature = await askSignature(rl);
			try {
				const recovered = await recoverEip712Signer({
					typedData,
					signature,
					expected: address,
				});
				console.log(
					`  ✓ Signature recovers to ${shorten(recovered)} (matches wallet)`,
				);
				break;
			} catch (err) {
				if (err instanceof SignatureMismatchError) {
					console.error(`  ✗ ${err.message}`);
					continue;
				}
				throw err;
			}
		}

		console.log("\nStep 3/4 — exchanging for API key");
		let jwt: string;
		try {
			const tokens = await mintJwtEip712({
				address,
				signature,
				baseUrl,
				clientId,
				timeoutMs,
			});
			jwt = tokens.accessToken;
			console.log("  ✓ JWT minted via /auth/login");
		} catch (err) {
			if (err instanceof HttpError && err.status === 401) {
				console.error(
					"  ✗ Pear rejected the signature. The sign-in message may have expired — re-run setup.",
				);
				exit(1);
			}
			throw err;
		}

		let apiKey: string;
		let apiKeyId: string;
		try {
			const result = await mintApiKey({
				jwt,
				name: tokenName,
				baseUrl,
				timeoutMs,
			});
			apiKey = result.apiKey;
			apiKeyId = result.id;
			console.log(
				`  ✓ API key minted via /api-keys (id: ${shorten(apiKeyId)})`,
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  ✗ API key minting failed: ${msg}`);
			console.error(
				`    JWT is still valid — you can use it directly:\n    PEAR_JWT=${jwt} mcp-pear`,
			);
			exit(0);
		}

		console.log("\nStep 4/4 — verifying");
		const verifiedOk = await verifyApiKey({
			apiKey,
			address,
			baseUrl,
			clientId,
			timeoutMs,
		});
		if (!verifiedOk) {
			console.error(
				"  ✗ Minted key didn't authenticate — this shouldn't happen. Report it.",
			);
			printKeyBlock({ apiKey, address });
			exit(1);
		}

		printKeyBlock({ apiKey, address });

		const status = await envFileStatus(cwd(), ["PEAR_API_KEY", "PEAR_ADDRESS"]);
		if (status.kind === "absent") {
			const yes = await askYesNo(rl, "Write these to ./.env?", true);
			if (yes) {
				await writeEnvVars(cwd(), {
					PEAR_API_KEY: apiKey,
					PEAR_ADDRESS: address,
				});
				console.log("  ✓ Wrote ./.env");
			}
		} else if (status.existingKeys.length === 0) {
			const yes = await askYesNo(rl, "Append to ./.env?", true);
			if (yes) {
				await writeEnvVars(cwd(), {
					PEAR_API_KEY: apiKey,
					PEAR_ADDRESS: address,
				});
				console.log("  ✓ Appended to ./.env");
			}
		} else {
			const list = status.existingKeys.join(", ");
			const yes = await askYesNo(
				rl,
				`./.env already has ${list}. Overwrite?`,
				false,
			);
			if (yes) {
				await writeEnvVars(cwd(), {
					PEAR_API_KEY: apiKey,
					PEAR_ADDRESS: address,
				});
				console.log(`  ✓ Updated ./.env (replaced ${list})`);
			}
		}

		console.log(
			"\nNext: add the same two env vars to your Claude Desktop config and restart Claude.",
		);
		console.log("See: https://npmjs.com/package/@marvelcodes/mcp-pear\n");
	} finally {
		rl.close();
	}
}

async function verifyApiKey(args: {
	apiKey: string;
	address: string;
	baseUrl: string;
	clientId: string;
	timeoutMs: number;
}): Promise<boolean> {
	const prev = {
		PEAR_API_KEY: env.PEAR_API_KEY,
		PEAR_ADDRESS: env.PEAR_ADDRESS,
		PEAR_JWT: env.PEAR_JWT,
		PEAR_REFRESH_TOKEN: env.PEAR_REFRESH_TOKEN,
	};
	env.PEAR_API_KEY = args.apiKey;
	env.PEAR_ADDRESS = args.address;
	env.PEAR_JWT = "";
	env.PEAR_REFRESH_TOKEN = "";
	resetConfigForTests();
	PearClient.resetForTests();
	try {
		const summary = await PearClient.getInstance().getAccountSummary();
		console.log(
			`  ✓ Authenticated call to /accounts succeeded (${summary.totalClosedTrades} closed trades)`,
		);
		return true;
	} catch {
		return false;
	} finally {
		for (const [k, v] of Object.entries(prev)) {
			if (v === undefined) delete env[k];
			else env[k] = v;
		}
		resetConfigForTests();
		PearClient.resetForTests();
	}
}

function openBrowser(url: string): void {
	const isMac = process.platform === "darwin";
	const isWin = process.platform === "win32";
	const cmd = isMac ? "open" : isWin ? "cmd" : "xdg-open";
	const args = isWin ? ["/c", "start", "", url] : [url];
	try {
		spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
	} catch {
		// Browser failed to open — caller already printed the URL.
	}
}

function shorten(s: string): string {
	if (s.length <= 12) return s;
	return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function printKeyBlock(args: { apiKey: string; address: string }): void {
	const bar = "─".repeat(50);
	console.log(`\n${bar}`);
	console.log(`  PEAR_API_KEY=${args.apiKey}`);
	console.log(`  PEAR_ADDRESS=${args.address}`);
	console.log(`${bar}\n`);
}
