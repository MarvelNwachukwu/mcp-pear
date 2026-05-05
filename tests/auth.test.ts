import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "../src/lib/config.js";
import { mintJwt, refreshJwt } from "../src/services/auth.js";
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
				baseUrl: "https://e.com",
				clientId: "APITRADER",
				timeoutMs: 5000,
			}),
		).rejects.toMatchObject({ status: 401 });
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
		process.env = { ...ORIGINAL_ENV, PEAR_API_KEY: "key-1" };
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
