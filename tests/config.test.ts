import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	ConfigError,
	getConfig,
	resetConfigForTests,
} from "../src/lib/config.js";

const ORIGINAL_ENV = { ...process.env };

describe("config", () => {
	beforeEach(() => {
		process.env = { ...ORIGINAL_ENV };
		process.env.PEAR_API_KEY = undefined;
		process.env.PEAR_API_BASE_URL = undefined;
		process.env.PEAR_API_TIMEOUT_MS = undefined;
		process.env.PEAR_CLIENT_ID = undefined;
		resetConfigForTests();
	});
	afterEach(() => {
		process.env = ORIGINAL_ENV;
		resetConfigForTests();
	});

	it("uses defaults when only optional vars are unset", () => {
		const cfg = getConfig();
		expect(cfg.baseUrl).toBe("https://hl-v2.pearprotocol.io");
		expect(cfg.timeoutMs).toBe(10000);
		expect(cfg.clientId).toBe("APITRADER");
		expect(cfg.apiKey).toBeUndefined();
	});

	it("reads custom values from env", () => {
		process.env.PEAR_API_KEY = "key-123";
		process.env.PEAR_API_BASE_URL = "https://example.com";
		process.env.PEAR_API_TIMEOUT_MS = "5000";
		process.env.PEAR_CLIENT_ID = "CUSTOM";
		const cfg = getConfig();
		expect(cfg.apiKey).toBe("key-123");
		expect(cfg.baseUrl).toBe("https://example.com");
		expect(cfg.timeoutMs).toBe(5000);
		expect(cfg.clientId).toBe("CUSTOM");
	});

	it("requireApiKey throws ConfigError when key absent", () => {
		expect(() => getConfig().requireApiKey("get_open_positions")).toThrow(
			ConfigError,
		);
	});

	it("requireApiKey returns key when present", () => {
		process.env.PEAR_API_KEY = "key-xyz";
		expect(getConfig().requireApiKey("any_tool")).toBe("key-xyz");
	});

	it("invalid PEAR_API_TIMEOUT_MS falls back to default", () => {
		process.env.PEAR_API_TIMEOUT_MS = "not-a-number";
		expect(getConfig().timeoutMs).toBe(10000);
	});
});
