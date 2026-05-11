import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigForTests } from "../src/lib/config.js";
import { mintApiKey } from "../src/services/auth.js";
import { PearClient } from "../src/services/pear-client.js";

const HAS_KEY = !!process.env.PEAR_API_KEY;
const HAS_JWT = !!process.env.PEAR_JWT;

describe.skipIf(!HAS_KEY)("smoke (live API)", () => {
	beforeEach(() => {
		resetConfigForTests();
		PearClient.resetForTests();
	});
	afterEach(() => {
		resetConfigForTests();
		PearClient.resetForTests();
	});

	it("get_health returns ok", async () => {
		const data = await PearClient.getInstance().getHealth();
		expect(data.status).toBe("ok");
		expect(typeof data.uptime).toBe("number");
	});

	it("list_markets returns at least one market", async () => {
		const data = await PearClient.getInstance().listMarkets({ pageSize: 1 });
		expect(data.markets.length).toBeGreaterThanOrEqual(1);
		expect(data.total).toBeGreaterThan(0);
	});

	it("get_account_summary returns the user's wallet", async () => {
		const data = await PearClient.getInstance().getAccountSummary();
		expect(data.agentWalletAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
	}, 30000);
});

describe.skipIf(!HAS_JWT)("smoke (live mintApiKey)", () => {
	it("mints a new API key labelled 'smoke-test-<ts>'", async () => {
		const baseUrl =
			process.env.PEAR_API_BASE_URL ?? "https://hl-v2.pearprotocol.io";
		const result = await mintApiKey({
			jwt: process.env.PEAR_JWT as string,
			name: `smoke-test-${Date.now()}`,
			baseUrl,
			timeoutMs: 15000,
		});
		expect(result.id).toMatch(/.+/);
		expect(result.apiKey).toMatch(/.+/);
	}, 30000);
});
