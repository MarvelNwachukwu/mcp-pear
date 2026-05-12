import { describe, expect, it } from "vitest";
import {
	SignatureMismatchError,
	normalizeTypedData,
	recoverEip712Signer,
} from "../src/lib/eip712.js";

// Fixture: typed data + signature produced by anvil account 0
// (private key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80).
// Signer recovers to 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266.
const TYPED_DATA = {
	domain: { name: "PearTest", version: "1", chainId: 1 },
	types: {
		EIP712Domain: [
			{ name: "name", type: "string" },
			{ name: "version", type: "string" },
			{ name: "chainId", type: "uint256" },
		],
		Message: [
			{ name: "contents", type: "string" },
			{ name: "nonce", type: "uint256" },
		],
	},
	primaryType: "Message",
	message: { contents: "hello pear", nonce: 1n },
} as const;

const SIGNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const GOOD_SIG =
	"0xc1b4e2ab39122c2bec14782b8427e6d2939eeb0c15a52d36273b52a084cfa6bb47bfe9ba056b684a13e5dbb06a242efccb4ae81895b508908e83921d07875f061b";

describe("recoverEip712Signer", () => {
	it("recovers the signer for a valid signature", async () => {
		const recovered = await recoverEip712Signer({
			typedData: TYPED_DATA,
			signature: GOOD_SIG,
		});
		expect(recovered.toLowerCase()).toBe(SIGNER.toLowerCase());
	});

	it("throws SignatureMismatchError when recovered != expected", async () => {
		await expect(
			recoverEip712Signer({
				typedData: TYPED_DATA,
				signature: GOOD_SIG,
				expected: "0x0000000000000000000000000000000000000000",
			}),
		).rejects.toBeInstanceOf(SignatureMismatchError);
	});

	it("returns recovered address when expected matches case-insensitively", async () => {
		const recovered = await recoverEip712Signer({
			typedData: TYPED_DATA,
			signature: GOOD_SIG,
			expected: SIGNER.toLowerCase(),
		});
		expect(recovered.toLowerCase()).toBe(SIGNER.toLowerCase());
	});
});

describe("normalizeTypedData", () => {
	it("injects canonical EIP712Domain when missing, in spec order", () => {
		const td = {
			domain: {
				name: "Pear Protocol",
				version: "1",
				chainId: 42161,
				verifyingContract: "0x0000000000000000000000000000000000000001",
			},
			types: {
				Authentication: [
					{ name: "address", type: "address" },
					{ name: "clientId", type: "string" },
					{ name: "timestamp", type: "uint256" },
					{ name: "action", type: "string" },
				],
			},
			primaryType: "Authentication",
			message: { foo: "bar" },
		};
		const out = normalizeTypedData(td);
		expect(out.types.EIP712Domain).toEqual([
			{ name: "name", type: "string" },
			{ name: "version", type: "string" },
			{ name: "chainId", type: "uint256" },
			{ name: "verifyingContract", type: "address" },
		]);
		// Original Authentication entry is preserved.
		expect(out.types.Authentication).toEqual(td.types.Authentication);
	});

	it("only includes domain fields actually present", () => {
		const td = {
			domain: { name: "X", chainId: 1 },
			types: { M: [] },
			primaryType: "M",
			message: {},
		};
		const out = normalizeTypedData(td);
		expect(out.types.EIP712Domain).toEqual([
			{ name: "name", type: "string" },
			{ name: "chainId", type: "uint256" },
		]);
	});

	it("is a no-op when EIP712Domain is already present", () => {
		const eip = [{ name: "name", type: "string" }];
		const td = {
			domain: { name: "X" },
			types: { EIP712Domain: eip, M: [] },
			primaryType: "M",
			message: {},
		};
		const out = normalizeTypedData(td);
		expect(out.types.EIP712Domain).toBe(eip);
	});
});
