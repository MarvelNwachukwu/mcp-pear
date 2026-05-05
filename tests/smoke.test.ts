import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigForTests } from "../src/lib/config.js";
import { PearClient } from "../src/services/pear-client.js";

const HAS_KEY = !!process.env.PEAR_API_KEY;

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
