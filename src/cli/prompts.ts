export interface ReadlineLike {
	question(prompt: string): Promise<string>;
	close(): void;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SIG_RE = /^0x[0-9a-fA-F]{130}$/;

export async function askAddress(rl: ReadlineLike): Promise<string> {
	while (true) {
		const ans = (await rl.question("Wallet address: ")).trim();
		if (ADDRESS_RE.test(ans)) return ans;
		console.error("  Address must be 0x followed by 40 hex chars.");
	}
}

export async function askSignature(rl: ReadlineLike): Promise<string> {
	while (true) {
		const ans = (await rl.question("Signature: ")).trim();
		if (SIG_RE.test(ans)) return ans;
		console.error(
			"  Signature must be 0x followed by 130 hex chars (65 bytes).",
		);
	}
}

export async function askTokenName(
	rl: ReadlineLike,
	defaultName: string,
): Promise<string> {
	const ans = (
		await rl.question(`Token name (default "${defaultName}"): `)
	).trim();
	return ans.length > 0 ? ans : defaultName;
}

export async function askYesNo(
	rl: ReadlineLike,
	question: string,
	defaultYes: boolean,
): Promise<boolean> {
	const hint = defaultYes ? "[Y/n]" : "[y/N]";
	const ans = (await rl.question(`${question} ${hint} `)).trim().toLowerCase();
	if (ans === "") return defaultYes;
	if (["y", "yes"].includes(ans)) return true;
	if (["n", "no"].includes(ans)) return false;
	return defaultYes;
}

export function defaultTokenName(opts: {
	hostname: string;
	now: Date;
}): string {
	const stem = opts.hostname.replace(/\..*$/, "").replace(/[^a-z0-9-]/gi, "-");
	const d = opts.now.toISOString().slice(0, 10);
	return `mcp-pear-${stem}-${d}`;
}
