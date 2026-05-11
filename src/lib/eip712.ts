import { recoverTypedDataAddress } from "viem";

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
