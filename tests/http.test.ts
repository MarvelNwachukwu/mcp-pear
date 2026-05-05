import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { HttpError, fetchJson } from "../src/lib/http.js";

describe("HttpError", () => {
	it("captures status, message, body, path", () => {
		const err = new HttpError(404, "Not Found", { message: "x" }, "/foo");
		expect(err.status).toBe(404);
		expect(err.message).toBe("Not Found");
		expect(err.body).toEqual({ message: "x" });
		expect(err.path).toBe("/foo");
	});
});

describe("fetchJson", () => {
	const fetchMock = vi.fn();
	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns parsed JSON on 200", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ hello: "world" }),
		});
		const result = await fetchJson<{ hello: string }>("https://example.com/x");
		expect(result).toEqual({ hello: "world" });
	});

	it("validates with provided zod schema", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ count: 5 }),
		});
		const schema = z.object({ count: z.number() });
		const result = await fetchJson("https://example.com/x", undefined, schema);
		expect(result).toEqual({ count: 5 });
	});

	it("throws when zod schema fails", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ count: "not-a-number" }),
		});
		const schema = z.object({ count: z.number() });
		await expect(
			fetchJson("https://example.com/x", undefined, schema),
		).rejects.toThrow();
	});

	it("throws HttpError on 4xx with parsed body", async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 404,
			statusText: "Not Found",
			json: async () => ({ message: "missing" }),
			headers: new Map(),
		});
		await expect(fetchJson("https://example.com/x")).rejects.toMatchObject({
			status: 404,
			body: { message: "missing" },
		});
	});

	it("throws HttpError on 5xx", async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 500,
			statusText: "Server Error",
			json: async () => ({ message: "boom" }),
			headers: new Map(),
		});
		await expect(fetchJson("https://example.com/x")).rejects.toMatchObject({
			status: 500,
		});
	});

	it("uses AbortController when timeoutMs provided", async () => {
		fetchMock.mockImplementation(
			(_url, init: RequestInit) =>
				new Promise((_, reject) => {
					init.signal?.addEventListener("abort", () =>
						reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
					);
				}),
		);
		await expect(
			fetchJson("https://example.com/slow", { timeoutMs: 10 } as never),
		).rejects.toThrow();
	});
});
