import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "../src/lib/config.js";
import {
	getEip712Message,
	mintApiKey,
	mintJwt,
	mintJwtEip712,
	refreshJwt,
} from "../src/services/auth.js";
import { PearClient } from "../src/services/pear-client.js";

const fetchMock = vi.fn();

describe("mintJwt", () => {
	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("posts to /auth/login with api_key method and returns tokens", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				accessToken: "AT",
				refreshToken: "RT",
				tokenType: "Bearer",
				expiresIn: 3600,
				address: "0xabc",
				clientId: "APITRADER",
			}),
		});
		const result = await mintJwt({
			apiKey: "key-1",
			address: "0x1234567890123456789012345678901234567890",
			baseUrl: "https://e.com",
			clientId: "APITRADER",
			timeoutMs: 5000,
		});
		expect(result.accessToken).toBe("AT");
		expect(result.refreshToken).toBe("RT");

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://e.com/auth/login");
		expect(init.method).toBe("POST");
		expect(init.headers).toMatchObject({ "content-type": "application/json" });
		expect(JSON.parse(init.body)).toEqual({
			method: "api_key",
			address: "0x1234567890123456789012345678901234567890",
			clientId: "APITRADER",
			details: { apiKey: "key-1" },
		});
	});

	it("propagates HttpError on auth failure", async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 401,
			statusText: "Unauthorized",
			json: async () => ({ message: "bad key" }),
			headers: new Map(),
		});
		await expect(
			mintJwt({
				apiKey: "bad",
				address: "0x1234567890123456789012345678901234567890",
				baseUrl: "https://e.com",
				clientId: "APITRADER",
				timeoutMs: 5000,
			}),
		).rejects.toMatchObject({ status: 401 });
	});
});

describe("getEip712Message", () => {
	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("calls GET /auth/eip712-message?address=… and returns parsed typed data", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				domain: { name: "PearProtocol", version: "1", chainId: 998 },
				types: {
					EIP712Domain: [{ name: "name", type: "string" }],
					Login: [],
				},
				primaryType: "Login",
				message: {},
			}),
		});

		const result = await getEip712Message({
			address: "0xeb6E3C2522b78bb0a5c65198eB35566b43171137",
			clientId: "APITRADER",
			baseUrl: "https://hl-v2.pearprotocol.io",
			timeoutMs: 5000,
		});
		expect(result.primaryType).toBe("Login");

		const [url] = fetchMock.mock.calls[0];
		expect(url).toContain("address=0xeb6E3C2522b78bb0a5c65198eB35566b43171137");
		expect(url).toContain("clientId=APITRADER");
		expect(
			url.startsWith("https://hl-v2.pearprotocol.io/auth/eip712-message?"),
		).toBe(true);
	});

	it("surfaces HttpError on 4xx", async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 400,
			statusText: "Bad Request",
			json: async () => ({ message: "Invalid address" }),
			headers: new Map(),
		});
		await expect(
			getEip712Message({
				address: "0xbad",
				clientId: "APITRADER",
				baseUrl: "https://x",
				timeoutMs: 5000,
			}),
		).rejects.toMatchObject({ status: 400 });
	});
});

describe("mintJwtEip712", () => {
	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("posts the eip712 login body and parses tokens", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				accessToken: "jwt-access",
				refreshToken: "jwt-refresh",
				expiresIn: 3600,
			}),
		});

		const tokens = await mintJwtEip712({
			address: "0xeb6E3C2522b78bb0a5c65198eB35566b43171137",
			signature: `0xabc${"0".repeat(127)}`,
			timestamp: 1778549048,
			baseUrl: "https://hl-v2.pearprotocol.io",
			clientId: "APITRADER",
			timeoutMs: 5000,
		});

		expect(tokens.accessToken).toBe("jwt-access");
		expect(tokens.refreshToken).toBe("jwt-refresh");

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://hl-v2.pearprotocol.io/auth/login");
		expect(JSON.parse(init.body)).toEqual({
			method: "eip712",
			address: "0xeb6E3C2522b78bb0a5c65198eB35566b43171137",
			clientId: "APITRADER",
			details: {
				signature: `0xabc${"0".repeat(127)}`,
				timestamp: 1778549048,
			},
		});
	});
});

describe("mintApiKey", () => {
	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("posts to /api-keys with bearer token and optional name", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 201,
			json: async () => ({
				id: "ak_xyz",
				apiKey: "pk_live_abc",
				name: "test",
				createdAt: "2026-05-11T00:00:00Z",
			}),
		});

		const result = await mintApiKey({
			jwt: "jwt-token",
			name: "test",
			baseUrl: "https://hl-v2.pearprotocol.io",
			timeoutMs: 5000,
		});

		expect(result.id).toBe("ak_xyz");
		expect(result.apiKey).toBe("pk_live_abc");

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://hl-v2.pearprotocol.io/api-keys");
		expect(init.headers).toMatchObject({ Authorization: "Bearer jwt-token" });
		expect(JSON.parse(init.body)).toEqual({ name: "test" });
	});

	it("omits name from body when not supplied", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 201,
			json: async () => ({ id: "x", apiKey: "y" }),
		});
		await mintApiKey({ jwt: "t", baseUrl: "https://x", timeoutMs: 5000 });
		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({});
	});
});

describe("refreshJwt", () => {
	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("posts to /auth/refresh with refreshToken and returns rotated tokens", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				accessToken: "AT2",
				refreshToken: "RT2",
				tokenType: "Bearer",
				expiresIn: 3600,
			}),
		});
		const result = await refreshJwt({
			refreshToken: "RT",
			baseUrl: "https://e.com",
			timeoutMs: 5000,
		});
		expect(result.accessToken).toBe("AT2");
		expect(result.refreshToken).toBe("RT2");

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://e.com/auth/refresh");
		expect(JSON.parse(init.body)).toEqual({ refreshToken: "RT" });
	});
});

describe("PearClient.ensureJwt ladder", () => {
	const ORIGINAL_ENV = { ...process.env };
	const fetchMockL = vi.fn();
	beforeEach(() => {
		fetchMockL.mockReset();
		vi.stubGlobal("fetch", fetchMockL);
		process.env = {
			...ORIGINAL_ENV,
			PEAR_API_KEY: "key-1",
			PEAR_ADDRESS: "0x1234567890123456789012345678901234567890",
		};
		resetConfigForTests();
		PearClient.resetForTests();
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		process.env = ORIGINAL_ENV;
		resetConfigForTests();
		PearClient.resetForTests();
	});

	it("mints JWT on first call when no cache", async () => {
		fetchMockL.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ accessToken: "AT", refreshToken: "RT" }),
		});
		const client = PearClient.getInstance();
		const token = await client.ensureJwtForTests();
		expect(token).toBe("AT");
		const [url, init] = fetchMockL.mock.calls[0];
		expect(url).toContain("/auth/login");
		expect(JSON.parse(init.body).method).toBe("api_key");
	});

	it("returns cached token without fetching", async () => {
		fetchMockL.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ accessToken: "AT", refreshToken: "RT" }),
		});
		const client = PearClient.getInstance();
		await client.ensureJwtForTests();
		fetchMockL.mockReset();
		const token = await client.ensureJwtForTests();
		expect(token).toBe("AT");
		expect(fetchMockL).not.toHaveBeenCalled();
	});

	it("uses refresh token when access token cleared", async () => {
		fetchMockL
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ accessToken: "AT", refreshToken: "RT" }),
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ accessToken: "AT2", refreshToken: "RT2" }),
			});
		const client = PearClient.getInstance();
		await client.ensureJwtForTests();
		client.invalidateAccessTokenForTests();
		const token = await client.ensureJwtForTests();
		expect(token).toBe("AT2");
		const [url, init] = fetchMockL.mock.calls[1];
		expect(url).toContain("/auth/refresh");
		expect(JSON.parse(init.body)).toEqual({ refreshToken: "RT" });
	});

	it("falls back to re-mint when refresh fails", async () => {
		fetchMockL
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ accessToken: "AT", refreshToken: "RT" }),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				json: async () => ({ message: "expired" }),
				headers: new Map(),
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ accessToken: "AT3", refreshToken: "RT3" }),
			});
		const client = PearClient.getInstance();
		await client.ensureJwtForTests();
		client.invalidateAccessTokenForTests();
		const token = await client.ensureJwtForTests();
		expect(token).toBe("AT3");
		// Calls: initial mint, refresh (failed), re-mint
		expect(fetchMockL).toHaveBeenCalledTimes(3);
		const [thirdUrl] = fetchMockL.mock.calls[2];
		expect(thirdUrl).toContain("/auth/login");
	});
});

describe("PearClient with PEAR_JWT (pass-through mode)", () => {
	const ORIGINAL_ENV = { ...process.env };
	const fetchMockJ = vi.fn();
	beforeEach(() => {
		fetchMockJ.mockReset();
		vi.stubGlobal("fetch", fetchMockJ);
		process.env = { ...ORIGINAL_ENV, PEAR_JWT: "preminted-AT" };
		process.env.PEAR_API_KEY = undefined;
		process.env.PEAR_ADDRESS = undefined;
		process.env.PEAR_REFRESH_TOKEN = undefined;
		resetConfigForTests();
		PearClient.resetForTests();
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		process.env = ORIGINAL_ENV;
		resetConfigForTests();
		PearClient.resetForTests();
	});

	it("uses PEAR_JWT directly without minting", async () => {
		const client = PearClient.getInstance();
		const token = await client.ensureJwtForTests();
		expect(token).toBe("preminted-AT");
		expect(fetchMockJ).not.toHaveBeenCalled();
	});

	it("refreshes when PEAR_JWT is invalidated and PEAR_REFRESH_TOKEN is set", async () => {
		process.env.PEAR_REFRESH_TOKEN = "preminted-RT";
		resetConfigForTests();
		PearClient.resetForTests();

		fetchMockJ.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				accessToken: "refreshed-AT",
				refreshToken: "refreshed-RT",
			}),
		});

		const client = PearClient.getInstance();
		const initial = await client.ensureJwtForTests();
		expect(initial).toBe("preminted-AT");
		client.invalidateAccessTokenForTests();
		const fresh = await client.ensureJwtForTests();
		expect(fresh).toBe("refreshed-AT");

		const [url, init] = fetchMockJ.mock.calls[0];
		expect(url).toContain("/auth/refresh");
		expect(JSON.parse(init.body)).toEqual({ refreshToken: "preminted-RT" });
	});

	it("throws orchestrator error when JWT expires and no fallback configured", async () => {
		const client = PearClient.getInstance();
		const initial = await client.ensureJwtForTests();
		expect(initial).toBe("preminted-AT");
		client.invalidateAccessTokenForTests();
		await expect(client.ensureJwtForTests()).rejects.toThrow(
			/JWT expired.*orchestrator must mint a new one/,
		);
		expect(fetchMockJ).not.toHaveBeenCalled();
	});

	it("surfaces orchestrator ConfigError when authedFetch hits 401 and no fallback", async () => {
		// First call to /accounts returns 401 (simulates expired JWT mid-session).
		// authedFetch will null the access token, call ensureJwt() again, and
		// since no refreshToken / apiKey is configured, acquireTokens throws the
		// orchestrator ConfigError. The 401 retry path never makes a second request.
		fetchMockJ.mockResolvedValueOnce({
			ok: false,
			status: 401,
			statusText: "Unauthorized",
			json: async () => ({ message: "expired" }),
			headers: new Map(),
		});

		const client = PearClient.getInstance();
		await expect(client.getAccountSummary()).rejects.toThrow(
			/JWT expired.*orchestrator must mint a new one/,
		);
		// Only the original /accounts call hit the network — no /auth/login or /auth/refresh.
		expect(fetchMockJ).toHaveBeenCalledTimes(1);
		const [url] = fetchMockJ.mock.calls[0];
		expect(url).toContain("/accounts");
	});

	it("falls through to mint via PEAR_API_KEY when JWT expires and api-key fallback is configured", async () => {
		process.env.PEAR_API_KEY = "fallback-key";
		process.env.PEAR_ADDRESS = "0x1234567890123456789012345678901234567890";
		resetConfigForTests();
		PearClient.resetForTests();

		// On 401 retry, ensureJwt skips refresh (no refreshToken), skips orchestrator-error
		// (apiKey is set), and mints via /auth/login.
		fetchMockJ.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				accessToken: "minted-AT",
				refreshToken: "minted-RT",
			}),
		});

		const client = PearClient.getInstance();
		const initial = await client.ensureJwtForTests();
		expect(initial).toBe("preminted-AT");
		client.invalidateAccessTokenForTests();
		const fresh = await client.ensureJwtForTests();
		expect(fresh).toBe("minted-AT");

		const [url, init] = fetchMockJ.mock.calls[0];
		expect(url).toContain("/auth/login");
		const body = JSON.parse(init.body);
		expect(body.method).toBe("api_key");
		expect(body.address).toBe("0x1234567890123456789012345678901234567890");
		expect(body.details.apiKey).toBe("fallback-key");
	});
});
