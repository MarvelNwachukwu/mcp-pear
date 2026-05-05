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
