import { describe, expect, it } from "vitest";
import {
	askAddress,
	askSignature,
	askTokenName,
	askYesNo,
	defaultTokenName,
} from "../src/cli/prompts.js";

function fakeReadline(answers: string[]) {
	const queue = [...answers];
	return {
		question: async () => {
			const next = queue.shift();
			if (next === undefined) throw new Error("ran out of scripted answers");
			return next;
		},
		close: () => {},
	};
}

describe("askAddress", () => {
	it("returns a valid 0x address on first try", async () => {
		const rl = fakeReadline(["0xeb6E3C2522b78bb0a5c65198eB35566b43171137"]);
		const addr = await askAddress(rl);
		expect(addr).toBe("0xeb6E3C2522b78bb0a5c65198eB35566b43171137");
	});

	it("re-prompts until a valid address is provided", async () => {
		const rl = fakeReadline([
			"not-an-address",
			"0xshort",
			"0xeb6E3C2522b78bb0a5c65198eB35566b43171137",
		]);
		const addr = await askAddress(rl);
		expect(addr).toBe("0xeb6E3C2522b78bb0a5c65198eB35566b43171137");
	});
});

describe("askSignature", () => {
	it("accepts a 0x + 130 hex char signature", async () => {
		const good = `0x${"a".repeat(130)}`;
		const rl = fakeReadline([good]);
		const sig = await askSignature(rl);
		expect(sig).toBe(good);
	});

	it("rejects short sigs and re-prompts", async () => {
		const good = `0x${"f".repeat(130)}`;
		const rl = fakeReadline(["0xshort", good]);
		const sig = await askSignature(rl);
		expect(sig).toBe(good);
	});
});

describe("askTokenName", () => {
	it("returns trimmed user input", async () => {
		const rl = fakeReadline(["  my key  "]);
		expect(await askTokenName(rl, "default-name")).toBe("my key");
	});

	it("returns default when empty", async () => {
		const rl = fakeReadline([""]);
		expect(await askTokenName(rl, "default-name")).toBe("default-name");
	});
});

describe("askYesNo", () => {
	it("returns true on y/Y/yes/Yes/empty when default is true", async () => {
		for (const ans of ["y", "Y", "yes", "YES", ""]) {
			const rl = fakeReadline([ans]);
			expect(await askYesNo(rl, "?", true)).toBe(true);
		}
	});

	it("returns false on n/N/no/empty when default is false", async () => {
		for (const ans of ["n", "N", "no", ""]) {
			const rl = fakeReadline([ans]);
			expect(await askYesNo(rl, "?", false)).toBe(false);
		}
	});
});

describe("defaultTokenName", () => {
	it("includes a date and a stable host stem", () => {
		const name = defaultTokenName({
			hostname: "marvel-mbp.local",
			now: new Date("2026-05-11T12:00:00Z"),
		});
		expect(name).toBe("mcp-pear-marvel-mbp-2026-05-11");
	});
});
