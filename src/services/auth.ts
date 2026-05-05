import { z } from "zod";
import { fetchJsonWithRetry } from "../lib/http.js";

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
	baseUrl: string;
	clientId: string;
	timeoutMs: number;
}

export async function mintJwt(params: MintJwtParams): Promise<JwtTokens> {
	const body = {
		method: "api_key",
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
