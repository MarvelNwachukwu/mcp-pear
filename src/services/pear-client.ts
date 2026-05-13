import type { ZodType } from "zod";
import { ConfigError, type PearConfig, getConfig } from "../lib/config.js";
import {
	type FetchJsonInit,
	HttpError,
	fetchJsonWithRetry,
} from "../lib/http.js";
import {
	AccountSummarySchema,
	ActiveMarketsResponseSchema,
	HealthResponseSchema,
	MarketsResponseSchema,
	OpenOrdersResponseSchema,
	PortfolioResponseSchema,
	PositionsResponseSchema,
	TradeHistoryResponseSchema,
	TwapOrdersResponseSchema,
} from "../types.js";
import { type JwtTokens, mintJwt, refreshJwt } from "./auth.js";

export interface ListMarketsParams {
	search?: string;
	engine?: string;
	minVolume?: number;
	change24h?: number;
	netFunding?: number;
	sort?: string;
	page?: number;
	pageSize?: number;
}

export interface TradeHistoryParams {
	limit?: number;
	startDate?: string;
	endDate?: string;
}

export class PearClient {
	private static instance: PearClient | undefined;
	private accessToken: string | null = null;
	private refreshToken: string | null = null;
	private mintInFlight: Promise<JwtTokens> | undefined;

	private constructor(private readonly config: PearConfig) {
		this.accessToken = config.jwt ?? null;
		this.refreshToken = config.refreshToken ?? null;
	}

	static getInstance(): PearClient {
		if (!PearClient.instance) {
			PearClient.instance = new PearClient(getConfig());
		}
		return PearClient.instance;
	}

	static resetForTests(): void {
		PearClient.instance = undefined;
	}

	/** @internal Test seam. Do not call from production code. */
	async ensureJwtForTests(): Promise<string> {
		return this.ensureJwt();
	}
	/** @internal Test seam. Do not call from production code. */
	invalidateAccessTokenForTests(): void {
		this.accessToken = null;
	}

	private async ensureJwt(): Promise<string> {
		if (this.accessToken) return this.accessToken;
		if (this.mintInFlight) {
			const tokens = await this.mintInFlight;
			this.accessToken = tokens.accessToken;
			return tokens.accessToken;
		}

		this.mintInFlight = this.acquireTokens();
		try {
			const tokens = await this.mintInFlight;
			this.accessToken = tokens.accessToken;
			this.refreshToken = tokens.refreshToken;
			return tokens.accessToken;
		} finally {
			this.mintInFlight = undefined;
		}
	}

	private async acquireTokens(): Promise<JwtTokens> {
		if (this.refreshToken) {
			try {
				return await refreshJwt({
					refreshToken: this.refreshToken,
					baseUrl: this.config.baseUrl,
					timeoutMs: this.config.timeoutMs,
				});
			} catch {
				this.refreshToken = null;
			}
		}
		if (this.config.jwt && !this.config.apiKey) {
			throw new ConfigError(
				"JWT expired; the orchestrator must mint a new one and restart mcp-pear.",
			);
		}
		const apiKey = this.config.requireApiKey("authenticated_tool");
		return await mintJwt({
			apiKey,
			address: this.config.requireAddress("authenticated_tool"),
			baseUrl: this.config.baseUrl,
			clientId: this.config.clientId,
			timeoutMs: this.config.timeoutMs,
		});
	}

	private async authedFetch<T>(
		path: string,
		init: FetchJsonInit,
		schema: ZodType<T>,
	): Promise<T> {
		const url = `${this.config.baseUrl}${path}`;
		const token = await this.ensureJwt();
		const reqInit: FetchJsonInit = {
			...init,
			headers: {
				...(init.headers ?? {}),
				Authorization: `Bearer ${token}`,
			},
			timeoutMs: this.config.timeoutMs,
		};
		try {
			return await fetchJsonWithRetry<T>(url, reqInit, schema);
		} catch (err) {
			if (err instanceof HttpError && err.status === 401) {
				this.accessToken = null;
				const fresh = await this.ensureJwt();
				const retryInit: FetchJsonInit = {
					...init,
					headers: {
						...(init.headers ?? {}),
						Authorization: `Bearer ${fresh}`,
					},
					timeoutMs: this.config.timeoutMs,
				};
				return await fetchJsonWithRetry<T>(url, retryInit, schema);
			}
			throw err;
		}
	}

	private async publicFetch<T>(path: string, schema: ZodType<T>): Promise<T> {
		const url = `${this.config.baseUrl}${path}`;
		return await fetchJsonWithRetry<T>(
			url,
			{ method: "GET", timeoutMs: this.config.timeoutMs },
			schema,
		);
	}

	// ---------- Public endpoints ----------

	getHealth() {
		return this.publicFetch("/health", HealthResponseSchema);
	}

	listMarkets(params: ListMarketsParams = {}) {
		const qs = new URLSearchParams();
		if (params.search) qs.set("searchText", params.search);
		if (params.engine) qs.set("engine", params.engine);
		if (params.minVolume !== undefined)
			qs.set("minVolume", String(params.minVolume));
		if (params.change24h !== undefined)
			qs.set("change24h", String(params.change24h));
		if (params.netFunding !== undefined)
			qs.set("netFunding", String(params.netFunding));
		if (params.sort) qs.set("sort", params.sort);
		if (params.page !== undefined) qs.set("page", String(params.page));
		if (params.pageSize !== undefined)
			qs.set("pageSize", String(params.pageSize));
		const q = qs.toString();
		return this.publicFetch(
			`/markets${q ? `?${q}` : ""}`,
			MarketsResponseSchema,
		);
	}

	getActiveMarkets() {
		return this.publicFetch("/markets/active", ActiveMarketsResponseSchema);
	}

	// ---------- Authenticated endpoints ----------

	getAccountSummary() {
		return this.authedFetch(
			"/accounts",
			{ method: "GET" },
			AccountSummarySchema,
		);
	}

	getOpenPositions() {
		return this.authedFetch(
			"/positions",
			{ method: "GET" },
			PositionsResponseSchema,
		);
	}

	getOpenOrders() {
		return this.authedFetch(
			"/orders/open",
			{ method: "GET" },
			OpenOrdersResponseSchema,
		);
	}

	getTwapOrders() {
		return this.authedFetch(
			"/orders/twap",
			{ method: "GET" },
			TwapOrdersResponseSchema,
		);
	}

	getTradeHistory(params: TradeHistoryParams = {}) {
		const qs = new URLSearchParams();
		if (params.limit !== undefined) qs.set("limit", String(params.limit));
		if (params.startDate) qs.set("startDate", params.startDate);
		if (params.endDate) qs.set("endDate", params.endDate);
		const q = qs.toString();
		return this.authedFetch(
			`/trade-history${q ? `?${q}` : ""}`,
			{ method: "GET" },
			TradeHistoryResponseSchema,
		);
	}

	getPortfolio() {
		return this.authedFetch(
			"/portfolio",
			{ method: "GET" },
			PortfolioResponseSchema,
		);
	}
}
