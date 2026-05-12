import { recoverTypedDataAddress } from "viem";

/** Canonical EIP-712 domain field types (per the EIP-712 spec, in order). */
const DOMAIN_FIELD_TYPES: ReadonlyArray<{ key: string; type: string }> = [
	{ key: "name", type: "string" },
	{ key: "version", type: "string" },
	{ key: "chainId", type: "uint256" },
	{ key: "verifyingContract", type: "address" },
	{ key: "salt", type: "bytes32" },
];

/**
 * Pear's /auth/eip712-message response omits `EIP712Domain` from `types`.
 * Wallets and viem both auto-derive it from the present `domain` keys, but
 * the two derivations can produce different field orderings — yielding
 * different typed-data hashes for the same logical data, and a wrong
 * recovered signer.
 *
 * Inject the canonical EIP712Domain entry explicitly so both sides hash
 * the same structure regardless of how each one would have inferred it.
 */
export function normalizeTypedData<
	T extends {
		domain: Record<string, unknown>;
		types: Record<string, ReadonlyArray<{ name: string; type: string }>>;
		primaryType: string;
		message: Record<string, unknown>;
	},
>(td: T): T {
	if (td.types.EIP712Domain) return td;
	const eip712Domain = DOMAIN_FIELD_TYPES.filter((f) => f.key in td.domain).map(
		(f) => ({ name: f.key, type: f.type }),
	);
	return {
		...td,
		types: { EIP712Domain: eip712Domain, ...td.types },
	};
}

export class SignatureMismatchError extends Error {
	constructor(
		public readonly recovered: string,
		public readonly expected: string,
	) {
		super(
			`Signature was signed by ${recovered}, expected ${expected}. Did you switch wallets?`,
		);
		this.name = "SignatureMismatchError";
	}
}

export interface RecoverParams {
	typedData: {
		domain: Record<string, unknown>;
		types: Record<string, ReadonlyArray<{ name: string; type: string }>>;
		primaryType: string;
		message: Record<string, unknown>;
	};
	signature: string;
	expected?: string;
}

type ViemRecoverArgs = Parameters<typeof recoverTypedDataAddress>[0];

export async function recoverEip712Signer(
	params: RecoverParams,
): Promise<string> {
	// viem's TypedData generic is stricter than runtime-shaped objects need.
	// We forward the runtime object as-is — viem only reads fields.
	const args = {
		...params.typedData,
		signature: params.signature as `0x${string}`,
	} as unknown as ViemRecoverArgs;
	const recovered = await recoverTypedDataAddress(args);
	if (
		params.expected &&
		recovered.toLowerCase() !== params.expected.toLowerCase()
	) {
		throw new SignatureMismatchError(recovered, params.expected);
	}
	return recovered;
}
