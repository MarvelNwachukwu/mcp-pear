import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { envFileStatus, writeEnvVars } from "../src/cli/env-writer.js";

let dir: string;

beforeEach(() => {
	dir = join(tmpdir(), `mcp-pear-env-${Date.now()}-${Math.random()}`);
	mkdirSync(dir, { recursive: true });
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("envFileStatus", () => {
	it("reports 'absent' when .env doesn't exist", async () => {
		const status = await envFileStatus(dir, ["PEAR_API_KEY", "PEAR_ADDRESS"]);
		expect(status).toEqual({ kind: "absent", existingKeys: [] });
	});

	it("reports 'present' with no conflicts when target keys are missing", async () => {
		writeFileSync(join(dir, ".env"), "FOO=bar\nBAZ=qux\n");
		const status = await envFileStatus(dir, ["PEAR_API_KEY", "PEAR_ADDRESS"]);
		expect(status).toEqual({ kind: "present", existingKeys: [] });
	});

	it("reports 'present' with conflicts when keys already exist", async () => {
		writeFileSync(join(dir, ".env"), "PEAR_API_KEY=old\nFOO=bar\n");
		const status = await envFileStatus(dir, ["PEAR_API_KEY", "PEAR_ADDRESS"]);
		expect(status).toEqual({
			kind: "present",
			existingKeys: ["PEAR_API_KEY"],
		});
	});
});

describe("writeEnvVars", () => {
	it("creates a new .env when none exists", async () => {
		await writeEnvVars(dir, {
			PEAR_API_KEY: "pk_test",
			PEAR_ADDRESS: "0xabc",
		});
		const contents = readFileSync(join(dir, ".env"), "utf8");
		expect(contents).toContain("PEAR_API_KEY=pk_test");
		expect(contents).toContain("PEAR_ADDRESS=0xabc");
	});

	it("appends to existing .env preserving unrelated vars", async () => {
		writeFileSync(join(dir, ".env"), "FOO=bar\n");
		await writeEnvVars(dir, { PEAR_API_KEY: "pk_test" });
		const contents = readFileSync(join(dir, ".env"), "utf8");
		expect(contents).toContain("FOO=bar");
		expect(contents).toContain("PEAR_API_KEY=pk_test");
	});

	it("overwrites existing keys in place when they're already present", async () => {
		writeFileSync(join(dir, ".env"), "PEAR_API_KEY=old\nFOO=bar\n");
		await writeEnvVars(dir, { PEAR_API_KEY: "pk_new" });
		const contents = readFileSync(join(dir, ".env"), "utf8");
		expect(contents).toContain("PEAR_API_KEY=pk_new");
		expect(contents).not.toContain("PEAR_API_KEY=old");
		expect(contents).toContain("FOO=bar");
	});

	it("ensures trailing newline", async () => {
		await writeEnvVars(dir, { PEAR_API_KEY: "pk_test" });
		const contents = readFileSync(join(dir, ".env"), "utf8");
		expect(contents.endsWith("\n")).toBe(true);
	});
});
