export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigError";
	}
}

export interface PearConfig {
	apiKey: string | undefined;
	baseUrl: string;
	timeoutMs: number;
	clientId: string;
	requireApiKey(toolName: string): string;
}

let cached: PearConfig | undefined;

export function getConfig(): PearConfig {
	if (cached) return cached;
	const apiKey = process.env.PEAR_API_KEY?.trim() || undefined;
	const baseUrl =
		process.env.PEAR_API_BASE_URL?.trim() || "https://hl-v2.pearprotocol.io";
	const parsedTimeout = Number(process.env.PEAR_API_TIMEOUT_MS);
	const timeoutMs =
		Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 10000;
	const clientId = process.env.PEAR_CLIENT_ID?.trim() || "APITRADER";

	cached = {
		apiKey,
		baseUrl,
		timeoutMs,
		clientId,
		requireApiKey(toolName: string) {
			if (!apiKey) {
				throw new ConfigError(
					`PEAR_API_KEY env var is required for \`${toolName}\`. Set it in your MCP client config and restart.`,
				);
			}
			return apiKey;
		},
	};
	return cached;
}

export function resetConfigForTests(): void {
	cached = undefined;
}
