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
		process.env.PEAR_ADDRESS = undefined;
		process.env.PEAR_API_BASE_URL = undefined;
		process.env.PEAR_API_TIMEOUT_MS = undefined;
		process.env.PEAR_CLIENT_ID = undefined;
		process.env.PEAR_JWT = undefined;
		process.env.PEAR_REFRESH_TOKEN = undefined;
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

	it("requireAddress throws ConfigError when address absent", () => {
		expect(() => getConfig().requireAddress("get_open_positions")).toThrow(
			ConfigError,
		);
	});

	it("requireAddress returns address when present", () => {
		process.env.PEAR_ADDRESS = "0x1234567890123456789012345678901234567890";
		expect(getConfig().requireAddress("any_tool")).toBe(
			"0x1234567890123456789012345678901234567890",
		);
	});

	it("reads PEAR_ADDRESS from env", () => {
		process.env.PEAR_ADDRESS = "0x1234567890123456789012345678901234567890";
		expect(getConfig().address).toBe(
			"0x1234567890123456789012345678901234567890",
		);
	});

	it("reads PEAR_JWT from env", () => {
		process.env.PEAR_JWT = "preminted-access-token";
		expect(getConfig().jwt).toBe("preminted-access-token");
	});

	it("reads PEAR_REFRESH_TOKEN from env", () => {
		process.env.PEAR_REFRESH_TOKEN = "preminted-refresh-token";
		expect(getConfig().refreshToken).toBe("preminted-refresh-token");
	});

	it("jwt and refreshToken default to undefined when env unset", () => {
		const cfg = getConfig();
		expect(cfg.jwt).toBeUndefined();
		expect(cfg.refreshToken).toBeUndefined();
	});

	describe("requireTradeEnabled", () => {
		it("throws when PEAR_TRADE_ENABLED is unset", () => {
			process.env.PEAR_TRADE_ENABLED = undefined;
			resetConfigForTests();
			expect(() =>
				getConfig().requireTradeEnabled("open_position"),
			).toThrowError(/PEAR_TRADE_ENABLED=true/);
		});

		it("throws on any non-'true' string", () => {
			for (const v of ["", "false", "True", "TRUE", "1", "yes", "no"]) {
				process.env.PEAR_TRADE_ENABLED = v;
				resetConfigForTests();
				expect(() => getConfig().requireTradeEnabled("x")).toThrow(ConfigError);
			}
		});

		it("passes when PEAR_TRADE_ENABLED === 'true'", () => {
			process.env.PEAR_TRADE_ENABLED = "true";
			resetConfigForTests();
			expect(() => getConfig().requireTradeEnabled("x")).not.toThrow();
		});

		it("error message names the tool", () => {
			process.env.PEAR_TRADE_ENABLED = undefined;
			resetConfigForTests();
			try {
				getConfig().requireTradeEnabled("open_position");
				throw new Error("should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(ConfigError);
				expect((err as Error).message).toContain("open_position");
			}
		});
	});
});
