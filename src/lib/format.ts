import { ConfigError } from "./config.js";
import { HttpError } from "./http.js";

export function renderResponse(summary: string, data: unknown): string {
	return `${summary}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

export function formatUsd(value: number | undefined | null): string {
	const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
	const sign = n < 0 ? "-" : "";
	const abs = Math.abs(n);
	const formatted = abs.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	return `${sign}$${formatted}`;
}

export function formatPct(value: number | undefined | null): string {
	const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
	const pct = n * 100;
	const sign = pct < 0 ? "-" : "+";
	return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

export function formatErrorMessage(err: unknown): string {
	if (err instanceof ConfigError) {
		return err.message;
	}
	if (err instanceof HttpError) {
		if (err.status === 401) {
			return "Authentication failed (HTTP 401). Verify PEAR_API_KEY (or PEAR_JWT) is valid and try again.";
		}
		if (err.status === 429) {
			const retryAfter = (err.body as Record<string, unknown> | undefined)?.[
				"retry-after"
			];
			return retryAfter
				? `Pear API rate limit exceeded. Retry after ${retryAfter}.`
				: "Pear API rate limit exceeded. Try again in a moment.";
		}
		const bodyMsg =
			typeof err.body === "object" && err.body && "message" in err.body
				? String((err.body as { message: unknown }).message)
				: err.message;
		return `Pear API error (HTTP ${err.status})${err.path ? ` on ${err.path}` : ""}: ${bodyMsg}`;
	}
	if (err instanceof Error && err.name === "AbortError") {
		return "Request timed out. Increase PEAR_API_TIMEOUT_MS or check network.";
	}
	if (err instanceof Error && err.name === "ZodError") {
		return `Pear API returned an unexpected response shape: ${err.message}. The API may have changed; please file an issue.`;
	}
	const msg = err instanceof Error ? err.message : String(err);
	return `Unexpected error: ${msg}`;
}
