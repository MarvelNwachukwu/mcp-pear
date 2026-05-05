import type { ZodType } from "zod";

export class HttpError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly body?: unknown,
		public readonly path?: string,
	) {
		super(message);
		this.name = "HttpError";
	}
}

export interface FetchJsonInit extends Omit<RequestInit, "signal"> {
	timeoutMs?: number;
}

export async function fetchJson<T = unknown>(
	url: string,
	init: FetchJsonInit = {},
	schema?: ZodType<T>,
): Promise<T> {
	const { timeoutMs, ...rest } = init;
	const controller = new AbortController();
	const timer =
		typeof timeoutMs === "number" && timeoutMs > 0
			? setTimeout(() => controller.abort(), timeoutMs)
			: undefined;

	let res: Response;
	try {
		res = await fetch(url, { ...rest, signal: controller.signal });
	} finally {
		if (timer) clearTimeout(timer);
	}

	const path = safeUrlPath(url);

	if (!res.ok) {
		let body: unknown;
		try {
			body = await res.json();
		} catch {
			body = undefined;
		}
		const retryAfter = res.headers?.get?.("retry-after") ?? undefined;
		const bodyWithMeta =
			retryAfter && typeof body === "object" && body
				? { ...(body as object), "retry-after": retryAfter }
				: body;
		throw new HttpError(
			res.status,
			res.statusText || `HTTP ${res.status}`,
			bodyWithMeta,
			path,
		);
	}

	const json = await res.json();
	return schema ? schema.parse(json) : (json as T);
}

function safeUrlPath(url: string): string {
	try {
		return new URL(url).pathname;
	} catch {
		return url;
	}
}

export interface RetryOptions {
	maxRetries: number;
	baseDelayMs: number;
	maxDelayMs?: number;
	jitterMs: number;
}

const DEFAULT_RETRY: RetryOptions = {
	maxRetries: 3,
	baseDelayMs: 250,
	maxDelayMs: 5000,
	jitterMs: 100,
};

export async function fetchJsonWithRetry<T = unknown>(
	url: string,
	init: FetchJsonInit = {},
	schema?: ZodType<T>,
	retryOpts: Partial<RetryOptions> = {},
): Promise<T> {
	const opts = { ...DEFAULT_RETRY, ...retryOpts };
	let lastErr: unknown;
	for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
		try {
			return await fetchJson<T>(url, init, schema);
		} catch (err) {
			lastErr = err;
			if (!isRetryable(err) || attempt === opts.maxRetries) {
				throw err;
			}
			const delay = retryDelayMs(err, attempt, opts);
			await sleep(delay);
		}
	}
	throw lastErr;
}

function isRetryable(err: unknown): boolean {
	if (err instanceof HttpError) {
		return err.status === 429 || err.status >= 500;
	}
	if (err instanceof Error && err.name === "AbortError") return true;
	if (err instanceof TypeError) return true; // fetch network error
	return false;
}

function retryDelayMs(
	err: unknown,
	attempt: number,
	opts: RetryOptions,
): number {
	if (err instanceof HttpError && err.body && typeof err.body === "object") {
		const retryAfter = (err.body as Record<string, unknown>)["retry-after"];
		if (typeof retryAfter === "string") {
			const secs = Number(retryAfter);
			if (Number.isFinite(secs) && secs > 0)
				return Math.min(secs * 1000, opts.maxDelayMs ?? 5000);
		}
	}
	const exp = 2 ** attempt * opts.baseDelayMs;
	const jitter = opts.jitterMs > 0 ? Math.random() * opts.jitterMs : 0;
	return Math.min(exp + jitter, opts.maxDelayMs ?? 5000);
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
