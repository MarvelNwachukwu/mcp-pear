import { z } from "zod";
import { fetchJson, fetchJsonWithRetry } from "../lib/http.js";
import {
	type ApiKeyResponse,
	ApiKeyResponseSchema,
	type AuthMessage,
	AuthMessageSchema,
} from "../types.js";

const LoginResponseSchema = z.object({
	accessToken: z.string(),
	refreshToken: z.string(),
	tokenType: z.string().optional(),
	expiresIn: z.number().optional(),
	address: z.string().optional(),
	clientId: z.string().optional(),
});

const RefreshResponseSchema = z.object({
	accessToken: z.string(),
	refreshToken: z.string(),
	tokenType: z.string().optional(),
	expiresIn: z.number().optional(),
});

export interface JwtTokens {
	accessToken: string;
	refreshToken: string;
	expiresIn?: number;
}

export interface MintJwtParams {
	apiKey: string;
	address: string;
	baseUrl: string;
	clientId: string;
	timeoutMs: number;
}

export async function mintJwt(params: MintJwtParams): Promise<JwtTokens> {
	const body = {
		method: "api_key",
		address: params.address,
		clientId: params.clientId,
		details: { apiKey: params.apiKey },
	};
	const result = await fetchJsonWithRetry(
		`${params.baseUrl}/auth/login`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
			timeoutMs: params.timeoutMs,
		},
		LoginResponseSchema,
	);
	return {
		accessToken: result.accessToken,
		refreshToken: result.refreshToken,
		expiresIn: result.expiresIn,
	};
}

export interface RefreshJwtParams {
	refreshToken: string;
	baseUrl: string;
	timeoutMs: number;
}

export async function refreshJwt(params: RefreshJwtParams): Promise<JwtTokens> {
	const result = await fetchJsonWithRetry(
		`${params.baseUrl}/auth/refresh`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ refreshToken: params.refreshToken }),
			timeoutMs: params.timeoutMs,
		},
		RefreshResponseSchema,
	);
	return {
		accessToken: result.accessToken,
		refreshToken: result.refreshToken,
		expiresIn: result.expiresIn,
	};
}

// ---------- Setup CLI endpoints ----------

export interface GetEip712MessageParams {
	address: string;
	clientId: string;
	baseUrl: string;
	timeoutMs: number;
}

export async function getEip712Message(
	params: GetEip712MessageParams,
): Promise<AuthMessage> {
	const qs = new URLSearchParams({
		address: params.address,
		clientId: params.clientId,
	});
	const url = `${params.baseUrl}/auth/eip712-message?${qs.toString()}`;
	return await fetchJson(
		url,
		{ method: "GET", timeoutMs: params.timeoutMs },
		AuthMessageSchema,
	);
}

export interface MintJwtEip712Params {
	address: string;
	signature: string;
	baseUrl: string;
	clientId: string;
	timeoutMs: number;
}

export async function mintJwtEip712(
	params: MintJwtEip712Params,
): Promise<JwtTokens> {
	const body = {
		method: "eip712",
		address: params.address,
		clientId: params.clientId,
		details: { signature: params.signature },
	};
	const result = await fetchJsonWithRetry(
		`${params.baseUrl}/auth/login`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
			timeoutMs: params.timeoutMs,
		},
		LoginResponseSchema,
	);
	return {
		accessToken: result.accessToken,
		refreshToken: result.refreshToken,
		expiresIn: result.expiresIn,
	};
}

export interface MintApiKeyParams {
	jwt: string;
	name?: string;
	baseUrl: string;
	timeoutMs: number;
}

export async function mintApiKey(
	params: MintApiKeyParams,
): Promise<ApiKeyResponse> {
	const body: Record<string, unknown> = {};
	if (params.name) body.name = params.name;
	return await fetchJsonWithRetry(
		`${params.baseUrl}/api-keys`,
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				Authorization: `Bearer ${params.jwt}`,
			},
			body: JSON.stringify(body),
			timeoutMs: params.timeoutMs,
		},
		ApiKeyResponseSchema,
	);
}
