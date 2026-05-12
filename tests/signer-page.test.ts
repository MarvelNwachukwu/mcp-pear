import { describe, expect, it } from "vitest";
import { generateSignerHtml } from "../src/cli/signer-page.js";

const TYPED_DATA = {
	domain: { name: "PearProtocol", version: "1", chainId: 998 },
	types: { EIP712Domain: [{ name: "name", type: "string" }], Login: [] },
	primaryType: "Login",
	message: {},
};

describe("generateSignerHtml", () => {
	it("embeds the address as displayed text", () => {
		const html = generateSignerHtml({
			address: "0xeb6E3C2522b78bb0a5c65198eB35566b43171137",
			typedData: TYPED_DATA,
		});
		expect(html).toContain("0xeb6E3C2522b78bb0a5c65198eB35566b43171137");
	});

	it("embeds typedData as parseable JSON in the script block", () => {
		const html = generateSignerHtml({
			address: "0x0000000000000000000000000000000000000000",
			typedData: TYPED_DATA,
		});
		const match = /const typedData\s*=\s*(\{[\s\S]*?\});/.exec(html);
		expect(match).toBeTruthy();
		if (!match) throw new Error("unreachable");
		// JSON.parse expects real JSON, so the embed must be JSON-safe.
		// Reverse the < -> < substitution before parsing.
		const decoded = match[1].replace(/\\u003c/g, "<");
		const parsed = JSON.parse(decoded);
		expect(parsed.primaryType).toBe("Login");
	});

	it("includes chain-switch logic and hint surface", () => {
		const html = generateSignerHtml({
			address: "0x0000000000000000000000000000000000000000",
			typedData: TYPED_DATA,
		});
		expect(html).toContain('id="chain-hint"');
		expect(html).toContain("wallet_switchEthereumChain");
		expect(html).toContain("eth_chainId");
	});

	it("escapes </script> inside typedData to prevent script breakout", () => {
		const evil = {
			...TYPED_DATA,
			message: { contents: "</script><script>alert(1)</script>" },
		};
		const html = generateSignerHtml({
			address: "0x0000000000000000000000000000000000000000",
			typedData: evil,
		});
		expect(html).not.toContain("</script><script>alert(1)");
	});
});
