export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigError";
	}
}

export interface PearConfig {
	apiKey: string | undefined;
	address: string | undefined;
	baseUrl: string;
	timeoutMs: number;
	clientId: string;
	jwt: string | undefined;
	refreshToken: string | undefined;
	requireApiKey(toolName: string): string;
	requireAddress(toolName: string): string;
}

let cached: PearConfig | undefined;

export function getConfig(): PearConfig {
	if (cached) return cached;
	const apiKey = process.env.PEAR_API_KEY?.trim() || undefined;
	const address = process.env.PEAR_ADDRESS?.trim() || undefined;
	const baseUrl =
		process.env.PEAR_API_BASE_URL?.trim() || "https://hl-v2.pearprotocol.io";
	const parsedTimeout = Number(process.env.PEAR_API_TIMEOUT_MS);
	const timeoutMs =
		Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 10000;
	const clientId = process.env.PEAR_CLIENT_ID?.trim() || "APITRADER";
	const jwt = process.env.PEAR_JWT?.trim() || undefined;
	const refreshToken = process.env.PEAR_REFRESH_TOKEN?.trim() || undefined;

	cached = {
		apiKey,
		address,
		baseUrl,
		timeoutMs,
		clientId,
		jwt,
		refreshToken,
		requireApiKey(toolName: string) {
			if (!apiKey) {
				throw new ConfigError(
					`PEAR_API_KEY env var is required for \`${toolName}\`. Set it in your MCP client config and restart.`,
				);
			}
			return apiKey;
		},
		requireAddress(toolName: string) {
			if (!address) {
				throw new ConfigError(
					`PEAR_ADDRESS env var is required for \`${toolName}\`. Set it to the wallet address bound to your PEAR_API_KEY and restart.`,
				);
			}
			return address;
		},
	};
	return cached;
}

export function resetConfigForTests(): void {
	cached = undefined;
}
