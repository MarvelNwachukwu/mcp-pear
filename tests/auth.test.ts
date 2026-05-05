import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mintJwt, refreshJwt } from "../src/services/auth.js";

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
