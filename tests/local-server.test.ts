import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { serveHtml } from "../src/cli/local-server.js";

let closeFn: (() => Promise<void>) | null = null;

afterEach(async () => {
	if (closeFn) {
		await closeFn();
		closeFn = null;
	}
});

describe("serveHtml", () => {
	it("serves the given HTML at the returned URL", async () => {
		const result = await serveHtml("<!doctype html><h1>hello</h1>");
		closeFn = result.close;
		expect(result.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
		const res = await fetch(result.url);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		expect(await res.text()).toContain("<h1>hello</h1>");
	});

	it("returns 405 on non-GET requests", async () => {
		const result = await serveHtml("<x>");
		closeFn = result.close;
		const res = await fetch(result.url, { method: "POST" });
		expect(res.status).toBe(405);
		expect(res.headers.get("allow")).toBe("GET");
	});

	it("close() shuts the server down", async () => {
		const result = await serveHtml("<x>");
		const url = result.url;
		await result.close();
		closeFn = null;
		await expect(fetch(url)).rejects.toThrow();
	});

	it("picks a fresh ephemeral port per call", async () => {
		const a = await serveHtml("<a/>");
		const b = await serveHtml("<b/>");
		expect(a.url).not.toBe(b.url);
		await a.close();
		await b.close();
	});
});
