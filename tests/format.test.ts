import { describe, expect, it } from "vitest";
import { ConfigError } from "../src/lib/config.js";
import {
	formatErrorMessage,
	formatPct,
	formatUsd,
	renderResponse,
} from "../src/lib/format.js";
import { HttpError } from "../src/lib/http.js";

describe("renderResponse", () => {
	it("emits summary then fenced JSON block", () => {
		const out = renderResponse("Found 2 markets.", { count: 2 });
		expect(out).toContain("Found 2 markets.");
		expect(out).toContain("```json");
		expect(out).toContain('"count": 2');
		expect(out).toContain("```");
	});
});

describe("formatUsd", () => {
	it("formats positive numbers with $ prefix and 2dp", () => {
		expect(formatUsd(1234.5)).toBe("$1,234.50");
	});
	it("formats negatives with leading minus", () => {
		expect(formatUsd(-12.3)).toBe("-$12.30");
	});
	it("handles zero", () => {
		expect(formatUsd(0)).toBe("$0.00");
	});
	it("handles undefined", () => {
		expect(formatUsd(undefined)).toBe("$0.00");
	});
});

describe("formatPct", () => {
	it("formats fractions as percent with sign and 2dp", () => {
		expect(formatPct(0.0234)).toBe("+2.34%");
		expect(formatPct(-0.05)).toBe("-5.00%");
		expect(formatPct(0)).toBe("+0.00%");
	});
	it("handles undefined as 0", () => {
		expect(formatPct(undefined)).toBe("+0.00%");
	});
});

describe("formatErrorMessage", () => {
	it("formats ConfigError verbatim", () => {
		const err = new ConfigError("PEAR_API_KEY required for `foo`. Set it.");
		expect(formatErrorMessage(err)).toBe(
			"PEAR_API_KEY required for `foo`. Set it.",
		);
	});
	it("formats 401 HttpError as auth failure", () => {
		const err = new HttpError(401, "Unauthorized", { message: "bad token" });
		expect(formatErrorMessage(err)).toContain(
			"Authentication failed (HTTP 401)",
		);
	});
	it("formats 429 HttpError with rate-limit hint", () => {
		const err = new HttpError(429, "Too Many Requests", {
			message: "slow down",
		});
		expect(formatErrorMessage(err)).toContain("rate limit");
	});
	it("formats other HttpError with status and body message", () => {
		const err = new HttpError(500, "Server Error", { message: "internal" });
		const msg = formatErrorMessage(err);
		expect(msg).toContain("HTTP 500");
		expect(msg).toContain("internal");
	});
	it("formats unknown errors", () => {
		const msg = formatErrorMessage(new Error("oops"));
		expect(msg).toContain("Unexpected error: oops");
	});

	it("includes path in HttpError message when present", () => {
		const err = new HttpError(
			500,
			"Server Error",
			{ message: "internal" },
			"/positions",
		);
		expect(formatErrorMessage(err)).toContain("on /positions");
	});

	it("formats AbortError as timeout message", () => {
		const err = Object.assign(new Error("aborted"), { name: "AbortError" });
		expect(formatErrorMessage(err)).toContain("timed out");
	});

	it("formats ZodError as schema mismatch message", () => {
		const err = Object.assign(new Error("Expected number, got string"), {
			name: "ZodError",
		});
		const msg = formatErrorMessage(err);
		expect(msg).toContain("unexpected response shape");
		expect(msg).toContain("Expected number, got string");
	});

	it("formats 429 HttpError without retry-after using generic message", () => {
		const err = new HttpError(429, "Too Many Requests", {
			message: "slow down",
		});
		const msg = formatErrorMessage(err);
		expect(msg).toContain("rate limit");
		expect(msg).not.toContain("Retry after");
	});
});
