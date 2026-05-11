import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type EnvFileStatus =
	| { kind: "absent"; existingKeys: [] }
	| { kind: "present"; existingKeys: string[] };

export async function envFileStatus(
	dir: string,
	targetKeys: string[],
): Promise<EnvFileStatus> {
	const path = join(dir, ".env");
	if (!existsSync(path)) return { kind: "absent", existingKeys: [] };
	const raw = await readFile(path, "utf8");
	const present = parseEnvKeys(raw);
	const conflicts = targetKeys.filter((k) => present.has(k));
	return { kind: "present", existingKeys: conflicts };
}

export async function writeEnvVars(
	dir: string,
	vars: Record<string, string>,
): Promise<void> {
	const path = join(dir, ".env");
	const existing = existsSync(path) ? await readFile(path, "utf8") : "";
	const lines = existing.length > 0 ? existing.split("\n") : [];
	const consumed = new Set<string>();
	const result: string[] = [];
	for (const line of lines) {
		const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
		if (match && Object.hasOwn(vars, match[1])) {
			result.push(`${match[1]}=${vars[match[1]]}`);
			consumed.add(match[1]);
		} else {
			result.push(line);
		}
	}
	for (const [k, v] of Object.entries(vars)) {
		if (!consumed.has(k)) result.push(`${k}=${v}`);
	}
	let out = result.join("\n");
	if (!out.endsWith("\n")) out += "\n";
	await writeFile(path, out, "utf8");
}

function parseEnvKeys(raw: string): Set<string> {
	const keys = new Set<string>();
	for (const line of raw.split("\n")) {
		const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
		if (match) keys.add(match[1]);
	}
	return keys;
}
