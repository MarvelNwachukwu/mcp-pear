# mcp-pear v0.1.1 — `setup` CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `npx @marvelcodes/mcp-pear setup` — a subcommand that walks the user through EIP-712 signing in a browser-bundled signer page, then mints a Pear API key via the live API. Closes the v0.1 onboarding gap.

**Architecture:** Single binary with argv-based dispatcher in `src/index.ts`. A new `src/cli/` directory holds the orchestrator (`setup.ts`), readline prompts, env-writer, and the static HTML signer. The runtime MCP server is unchanged. `viem` is added as a runtime dep, but only loaded on the setup path via dynamic import — runtime cost is zero.

**Tech Stack:** TypeScript 5.6, Node ≥22, zod 3.x, viem 2.x (new), readline, child_process (`open`/`xdg-open`/`start` for browser launch), Vitest 2.x for tests.

**Spec:** [`docs/superpowers/specs/2026-05-11-mcp-pear-setup-cli.md`](../specs/2026-05-11-mcp-pear-setup-cli.md)

---

## File map

**Created:**
- `src/cli/setup.ts` — orchestrator (~150 lines)
- `src/cli/prompts.ts` — readline wrappers (~80 lines)
- `src/cli/signer-page.ts` — pure HTML generator (~120 lines)
- `src/cli/env-writer.ts` — safe .env handling (~80 lines)
- `src/lib/eip712.ts` — signature verification via viem (~30 lines)
- `tests/eip712.test.ts`
- `tests/prompts.test.ts`
- `tests/signer-page.test.ts`
- `tests/env-writer.test.ts`
- `.changeset/setup-cli.md`

**Modified:**
- `src/index.ts` — argv dispatcher
- `src/services/auth.ts` — add `getEip712Message`, `mintJwtEip712`, `mintApiKey`
- `src/types.ts` — add `AuthMessageSchema`, `ApiKeyResponseSchema`
- `tests/auth.test.ts` — extend with new auth functions
- `tests/schemas.test.ts` — add new schema tests
- `tests/smoke.test.ts` — gated `mintApiKey` live smoke
- `package.json` — add `viem` dep, bump to `0.1.1`
- `README.md` — lead with `setup` flow; demote DevTools to advanced section

**Commits:** one per task. 13 commits total.

---

## Task 0: Add `viem` dependency

**Files:**
- Modify: `package.json` (dependencies)

- [ ] **Step 1: Install viem**

```bash
cd /Users/0xmarvel/.superset/projects/mcp-pear
pnpm add viem
```

Expected: `package.json` `dependencies` gains `viem: "^2.x"`. `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify import works**

```bash
node -e "import('viem').then(m => console.log(typeof m.recoverTypedDataAddress))"
```

Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add viem for EIP-712 signature verification in setup CLI"
```

---

## Task 1: `lib/eip712.ts` — signature verification

**Files:**
- Create: `src/lib/eip712.ts`
- Test: `tests/eip712.test.ts`

A pure wrapper around viem's `recoverTypedDataAddress` that throws a domain-specific error on mismatch.

- [ ] **Step 1: Write the failing test**

Create `tests/eip712.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { recoverEip712Signer, SignatureMismatchError } from "../src/lib/eip712.js";

// Fixture: typed data + signature produced by a known private key.
// Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
// Signer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (anvil account 0)
// Generated offline via viem's signTypedData with the same typed data below.
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
	"0xfb47e4cb8a96d9d0c4be2ce4cd0bc18024b3b9c4dfa5cefb1ec1e1d8a5e0cb55" +
	"3fae6cc20fb0c8ce25a9aa3a4e51f96d4f3b1f78f1be6fc04bd9af1c1c30b88a1b";

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
```

> **Note on the fixture signature:** the literal `GOOD_SIG` above is a placeholder hash pattern. Before this step, you must generate a real signature using viem in a one-off node script. Run this **once** and replace `GOOD_SIG` with the output:
>
> ```bash
> pnpm exec node --input-type=module -e "
> import { privateKeyToAccount } from 'viem/accounts';
> const acc = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
> const sig = await acc.signTypedData({
>   domain: { name: 'PearTest', version: '1', chainId: 1 },
>   types: { EIP712Domain: [{name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'}], Message: [{name:'contents',type:'string'},{name:'nonce',type:'uint256'}] },
>   primaryType: 'Message',
>   message: { contents: 'hello pear', nonce: 1n },
> });
> console.log(sig);
> "
> ```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test eip712 2>&1 | tail -20
```

Expected: FAIL with `Cannot find module '../src/lib/eip712.js'`.

- [ ] **Step 3: Implement the module**

Create `src/lib/eip712.ts`:

```typescript
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
	/** Optional. If provided, throws SignatureMismatchError when the recovered address differs (case-insensitive). */
	expected?: string;
}

export async function recoverEip712Signer(
	params: RecoverParams,
): Promise<string> {
	// biome-ignore lint/suspicious/noExplicitAny: viem's TypedData type is too strict for runtime-shaped objects.
	const recovered = await recoverTypedDataAddress({
		domain: params.typedData.domain as any,
		types: params.typedData.types as any,
		primaryType: params.typedData.primaryType as any,
		message: params.typedData.message as any,
		signature: params.signature as `0x${string}`,
	});
	if (
		params.expected &&
		recovered.toLowerCase() !== params.expected.toLowerCase()
	) {
		throw new SignatureMismatchError(recovered, params.expected);
	}
	return recovered;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test eip712 2>&1 | tail -10
```

Expected: 3 passed.

- [ ] **Step 5: Run full suite to ensure no regression**

```bash
pnpm test 2>&1 | tail -10
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/eip712.ts tests/eip712.test.ts
git commit -m "feat(setup): add EIP-712 signature verification via viem"
```

---

## Task 2: `types.ts` — new schemas

**Files:**
- Modify: `src/types.ts`
- Test: `tests/schemas.test.ts` (extend)

Add `AuthMessageSchema` (response shape of `/auth/eip712-message`) and `ApiKeyResponseSchema` (response shape of `POST /api-keys`).

- [ ] **Step 1: Write the failing test**

Append to `tests/schemas.test.ts`:

```typescript
import { ApiKeyResponseSchema, AuthMessageSchema } from "../src/types.js";

describe("AuthMessageSchema", () => {
	it("parses a representative /auth/eip712-message response", () => {
		const live = {
			domain: {
				name: "PearProtocol",
				version: "1",
				chainId: 998,
				verifyingContract: "0x1234567890123456789012345678901234567890",
			},
			types: {
				EIP712Domain: [
					{ name: "name", type: "string" },
					{ name: "version", type: "string" },
					{ name: "chainId", type: "uint256" },
					{ name: "verifyingContract", type: "address" },
				],
				Login: [
					{ name: "address", type: "address" },
					{ name: "nonce", type: "uint256" },
					{ name: "expiresAt", type: "uint256" },
				],
			},
			primaryType: "Login",
			message: {
				address: "0xeb6E3C2522b78bb0a5c65198eB35566b43171137",
				nonce: "12345",
				expiresAt: "1780000000",
			},
		};
		const parsed = AuthMessageSchema.parse(live);
		expect(parsed.primaryType).toBe("Login");
		expect(parsed.message.address).toBe(live.message.address);
	});

	it("accepts arbitrary extra fields in domain (forward-compatible)", () => {
		const live = {
			domain: { name: "X", version: "1", chainId: 1, salt: "0xdead" },
			types: { EIP712Domain: [{ name: "name", type: "string" }], M: [] },
			primaryType: "M",
			message: {},
		};
		expect(() => AuthMessageSchema.parse(live)).not.toThrow();
	});
});

describe("ApiKeyResponseSchema", () => {
	it("parses a representative POST /api-keys response", () => {
		const live = {
			id: "ak_2yT4xQ",
			apiKey: "pk_live_abc123def456",
			name: "mcp-pear-marvel-mbp-2026-05-11",
			createdAt: "2026-05-11T10:00:00.000Z",
		};
		const parsed = ApiKeyResponseSchema.parse(live);
		expect(parsed.id).toBe("ak_2yT4xQ");
		expect(parsed.apiKey).toBe("pk_live_abc123def456");
	});

	it("permits createdAt as numeric string or number", () => {
		const a = ApiKeyResponseSchema.parse({
			id: "x",
			apiKey: "y",
			name: "z",
			createdAt: "1772760462927",
		});
		expect(typeof a.createdAt).toBe("string");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test schemas 2>&1 | tail -10
```

Expected: 3 new tests FAIL (no `AuthMessageSchema` / `ApiKeyResponseSchema` export).

- [ ] **Step 3: Add the schemas**

In `src/types.ts`, append (before any `// end of file` markers):

```typescript
// ---------- Setup CLI schemas ----------

export const Eip712TypeFieldSchema = z.object({
	name: z.string(),
	type: z.string(),
});

export const AuthMessageSchema = z.object({
	domain: z.record(z.unknown()),
	types: z.record(z.array(Eip712TypeFieldSchema)),
	primaryType: z.string(),
	message: z.record(z.unknown()),
});
export type AuthMessage = z.infer<typeof AuthMessageSchema>;

export const ApiKeyResponseSchema = z.object({
	id: z.string(),
	apiKey: z.string(),
	name: z.string().optional(),
	createdAt: z.union([z.string(), z.number()]).optional(),
});
export type ApiKeyResponse = z.infer<typeof ApiKeyResponseSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test schemas 2>&1 | tail -10
```

Expected: all schemas tests pass (5 total in that file now).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts tests/schemas.test.ts
git commit -m "feat(setup): add AuthMessageSchema + ApiKeyResponseSchema"
```

---

## Task 3: `auth.ts` — `getEip712Message`

**Files:**
- Modify: `src/services/auth.ts`
- Test: `tests/auth.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `tests/auth.test.ts` (inside the existing describe-block structure, or as a new sibling describe):

```typescript
import { getEip712Message } from "../src/services/auth.js";

describe("getEip712Message", () => {
	const realFetch = globalThis.fetch;
	afterEach(() => {
		globalThis.fetch = realFetch;
	});

	it("calls GET /auth/eip712-message?address=… and returns parsed typed data", async () => {
		const mockResponse = {
			domain: { name: "PearProtocol", version: "1", chainId: 998 },
			types: { EIP712Domain: [{ name: "name", type: "string" }], Login: [] },
			primaryType: "Login",
			message: {},
		};
		let calledUrl = "";
		globalThis.fetch = (async (url: string) => {
			calledUrl = url;
			return new Response(JSON.stringify(mockResponse), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as typeof fetch;

		const result = await getEip712Message({
			address: "0xeb6E3C2522b78bb0a5c65198eB35566b43171137",
			baseUrl: "https://hl-v2.pearprotocol.io",
			timeoutMs: 5000,
		});
		expect(calledUrl).toBe(
			"https://hl-v2.pearprotocol.io/auth/eip712-message?address=0xeb6E3C2522b78bb0a5c65198eB35566b43171137",
		);
		expect(result.primaryType).toBe("Login");
	});

	it("surfaces HttpError on 4xx", async () => {
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ message: "Invalid address" }), {
				status: 400,
				headers: { "content-type": "application/json" },
			})) as typeof fetch;
		await expect(
			getEip712Message({
				address: "0xbad",
				baseUrl: "https://x",
				timeoutMs: 5000,
			}),
		).rejects.toThrow(/HTTP 400|Bad Request/);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test auth 2>&1 | tail -15
```

Expected: 2 new tests FAIL (no `getEip712Message` export).

- [ ] **Step 3: Implement**

Append to `src/services/auth.ts`:

```typescript
import { AuthMessageSchema, type AuthMessage } from "../types.js";
import { fetchJson } from "../lib/http.js";

export interface GetEip712MessageParams {
	address: string;
	baseUrl: string;
	timeoutMs: number;
}

export async function getEip712Message(
	params: GetEip712MessageParams,
): Promise<AuthMessage> {
	const url = `${params.baseUrl}/auth/eip712-message?address=${encodeURIComponent(params.address)}`;
	return await fetchJson(
		url,
		{ method: "GET", timeoutMs: params.timeoutMs },
		AuthMessageSchema,
	);
}
```

> **Note:** the existing `auth.ts` imports `fetchJsonWithRetry` for the api_key login path. For `getEip712Message` we use `fetchJson` (no retry) because the response is one-shot and we want fast failure on misconfig. If `fetchJson` isn't already imported, add it to the existing import line.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test auth 2>&1 | tail -15
```

Expected: all auth tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/auth.ts tests/auth.test.ts
git commit -m "feat(setup): add getEip712Message to auth service"
```

---

## Task 4: `auth.ts` — `mintJwtEip712`

**Files:**
- Modify: `src/services/auth.ts`
- Test: `tests/auth.test.ts` (extend)

A second mint function for the EIP-712 method. Kept separate from the existing `mintJwt` (api_key) for clarity — they post different bodies.

- [ ] **Step 1: Write the failing test**

Append to `tests/auth.test.ts`:

```typescript
import { mintJwtEip712 } from "../src/services/auth.js";

describe("mintJwtEip712", () => {
	const realFetch = globalThis.fetch;
	afterEach(() => {
		globalThis.fetch = realFetch;
	});

	it("posts the eip712 login body and parses tokens out", async () => {
		let bodySent: unknown;
		globalThis.fetch = (async (url: string, init: RequestInit) => {
			bodySent = JSON.parse(init.body as string);
			return new Response(
				JSON.stringify({
					accessToken: "jwt-access",
					refreshToken: "jwt-refresh",
					expiresIn: 3600,
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}) as typeof fetch;

		const tokens = await mintJwtEip712({
			address: "0xeb6E3C2522b78bb0a5c65198eB35566b43171137",
			signature: "0xabc" + "0".repeat(128),
			baseUrl: "https://hl-v2.pearprotocol.io",
			clientId: "APITRADER",
			timeoutMs: 5000,
		});

		expect(tokens.accessToken).toBe("jwt-access");
		expect(tokens.refreshToken).toBe("jwt-refresh");
		expect(bodySent).toEqual({
			method: "eip712",
			address: "0xeb6E3C2522b78bb0a5c65198eB35566b43171137",
			clientId: "APITRADER",
			details: { signature: "0xabc" + "0".repeat(128) },
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test auth 2>&1 | tail -15
```

Expected: 1 new test FAIL.

- [ ] **Step 3: Implement**

Append to `src/services/auth.ts`:

```typescript
export interface MintJwtEip712Params {
	address: string;
	signature: string;
	baseUrl: string;
	clientId: string;
	timeoutMs: number;
}

export async function mintJwtEip712(
	params: MintJwtEip712Params,
): Promise<JwtTokens> {
	const body = {
		method: "eip712",
		address: params.address,
		clientId: params.clientId,
		details: { signature: params.signature },
	};
	const result = await fetchJsonWithRetry(
		`${params.baseUrl}/auth/login`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
			timeoutMs: params.timeoutMs,
		},
		LoginResponseSchema,
	);
	return {
		accessToken: result.accessToken,
		refreshToken: result.refreshToken,
		expiresIn: result.expiresIn,
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test auth 2>&1 | tail -10
```

Expected: all auth tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/auth.ts tests/auth.test.ts
git commit -m "feat(setup): add mintJwtEip712 to auth service"
```

---

## Task 5: `auth.ts` — `mintApiKey`

**Files:**
- Modify: `src/services/auth.ts`
- Test: `tests/auth.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `tests/auth.test.ts`:

```typescript
import { mintApiKey } from "../src/services/auth.js";

describe("mintApiKey", () => {
	const realFetch = globalThis.fetch;
	afterEach(() => {
		globalThis.fetch = realFetch;
	});

	it("posts to /api-keys with bearer token and optional name", async () => {
		let receivedAuth = "";
		let receivedBody: unknown;
		globalThis.fetch = (async (url: string, init: RequestInit) => {
			receivedAuth =
				(init.headers as Record<string, string>)?.Authorization ?? "";
			receivedBody = JSON.parse(init.body as string);
			return new Response(
				JSON.stringify({
					id: "ak_xyz",
					apiKey: "pk_live_abc",
					name: "test",
					createdAt: "2026-05-11T00:00:00Z",
				}),
				{ status: 201, headers: { "content-type": "application/json" } },
			);
		}) as typeof fetch;

		const result = await mintApiKey({
			jwt: "jwt-token",
			name: "test",
			baseUrl: "https://hl-v2.pearprotocol.io",
			timeoutMs: 5000,
		});

		expect(receivedAuth).toBe("Bearer jwt-token");
		expect(receivedBody).toEqual({ name: "test" });
		expect(result.id).toBe("ak_xyz");
		expect(result.apiKey).toBe("pk_live_abc");
	});

	it("omits name from body when not supplied", async () => {
		let receivedBody: unknown;
		globalThis.fetch = (async (_url: string, init: RequestInit) => {
			receivedBody = JSON.parse(init.body as string);
			return new Response(
				JSON.stringify({ id: "x", apiKey: "y" }),
				{ status: 201, headers: { "content-type": "application/json" } },
			);
		}) as typeof fetch;
		await mintApiKey({ jwt: "t", baseUrl: "https://x", timeoutMs: 5000 });
		expect(receivedBody).toEqual({});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test auth 2>&1 | tail -10
```

Expected: 2 new tests FAIL.

- [ ] **Step 3: Implement**

Append to `src/services/auth.ts`:

```typescript
import { ApiKeyResponseSchema, type ApiKeyResponse } from "../types.js";

export interface MintApiKeyParams {
	jwt: string;
	name?: string;
	baseUrl: string;
	timeoutMs: number;
}

export async function mintApiKey(
	params: MintApiKeyParams,
): Promise<ApiKeyResponse> {
	const body: Record<string, unknown> = {};
	if (params.name) body.name = params.name;
	return await fetchJsonWithRetry(
		`${params.baseUrl}/api-keys`,
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				Authorization: `Bearer ${params.jwt}`,
			},
			body: JSON.stringify(body),
			timeoutMs: params.timeoutMs,
		},
		ApiKeyResponseSchema,
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test auth 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/services/auth.ts tests/auth.test.ts
git commit -m "feat(setup): add mintApiKey to auth service"
```

---

## Task 6: `cli/env-writer.ts`

**Files:**
- Create: `src/cli/env-writer.ts`
- Test: `tests/env-writer.test.ts`

Reads an existing `.env` (or none), reports which target keys are present, and writes new content. Never overwrites without explicit consent.

- [ ] **Step 1: Write the failing test**

Create `tests/env-writer.test.ts`:

```typescript
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	envFileStatus,
	writeEnvVars,
} from "../src/cli/env-writer.js";

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
		expect(status).toEqual({
			kind: "absent",
			existingKeys: [],
		});
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
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test env-writer 2>&1 | tail -10
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement**

Create `src/cli/env-writer.ts`:

```typescript
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
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
	const present = parseEnvKeys(existing);

	// Replace existing keys in place; append new ones.
	const result: string[] = [];
	const consumed = new Set<string>();
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

	// Ensure trailing newline.
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test env-writer 2>&1 | tail -10
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/cli/env-writer.ts tests/env-writer.test.ts
git commit -m "feat(setup): add safe .env writer (in-place replace + append)"
```

---

## Task 7: `cli/signer-page.ts`

**Files:**
- Create: `src/cli/signer-page.ts`
- Test: `tests/signer-page.test.ts`

Pure function that generates a self-contained HTML page with the typed data injected via `JSON.stringify`. No CSS frameworks, no external scripts.

- [ ] **Step 1: Write the failing test**

Create `tests/signer-page.test.ts`:

```typescript
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateSignerHtml, writeSignerPage } from "../src/cli/signer-page.js";

let dir: string;
beforeEach(() => {
	dir = join(tmpdir(), `mcp-pear-signer-${Date.now()}-${Math.random()}`);
	mkdirSync(dir, { recursive: true });
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

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

	it("embeds typedData as parseable JSON in a script block", () => {
		const html = generateSignerHtml({
			address: "0x0",
			typedData: TYPED_DATA,
		});
		// Extract the JSON injected after `const typedData = `.
		const match = /const typedData\s*=\s*(\{[\s\S]*?\});/.exec(html);
		expect(match).toBeTruthy();
		const parsed = JSON.parse(match![1]);
		expect(parsed.primaryType).toBe("Login");
	});

	it("escapes </script> in typedData to prevent XSS", () => {
		const evil = {
			...TYPED_DATA,
			message: { contents: "</script><script>alert(1)</script>" },
		};
		const html = generateSignerHtml({ address: "0x0", typedData: evil });
		// The literal closing tag must not appear inside the data block.
		// JSON.stringify with the script-safe replacement turns </script> into <\/script>.
		expect(html).not.toMatch(/<\/script><script>alert/);
	});
});

describe("writeSignerPage", () => {
	it("writes an HTML file and returns a file:// URL", async () => {
		const result = await writeSignerPage({
			outDir: dir,
			address: "0x0",
			typedData: TYPED_DATA,
		});
		expect(result.filePath).toMatch(/mcp-pear-sign-.*\.html$/);
		expect(result.fileUrl).toMatch(/^file:\/\//);
		const html = readFileSync(result.filePath, "utf8");
		expect(html).toContain("<!doctype html>");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test signer-page 2>&1 | tail -10
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement**

Create `src/cli/signer-page.ts`:

```typescript
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

export interface SignerPageInput {
	address: string;
	typedData: unknown;
}

export interface WriteSignerPageInput extends SignerPageInput {
	outDir: string;
}

export interface WriteSignerPageResult {
	filePath: string;
	fileUrl: string;
}

/**
 * Pure function. Returns a self-contained HTML document with the typed data
 * embedded via JSON.stringify (script-tag-safe).
 */
export function generateSignerHtml(input: SignerPageInput): string {
	const typedDataJson = scriptSafeJson(input.typedData);
	const addressEscaped = htmlEscape(input.address);
	return `<!doctype html>
<meta charset="utf-8">
<title>mcp-pear — sign in to Pear Protocol</title>
<style>
  body { font: 14px/1.4 -apple-system, system-ui, sans-serif; max-width: 640px; margin: 2em auto; padding: 0 1em; color: #222; }
  h1 { font-size: 1.4em; }
  code { font: 13px/1.4 ui-monospace, monospace; background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
  button { font: inherit; padding: 8px 16px; margin-right: 8px; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  textarea { width: 100%; height: 6em; font: 12px ui-monospace, monospace; box-sizing: border-box; }
  .status { margin: 1em 0; padding: 8px 12px; border-radius: 4px; }
  .status.ok { background: #e6f7e6; color: #1a5e1a; }
  .status.err { background: #fde7e7; color: #8b1a1a; }
  .muted { color: #666; }
</style>

<h1>Sign in to Pear Protocol</h1>
<p>Wallet expected: <code>${addressEscaped}</code></p>
<p class="muted">Connect your wallet, sign the typed data, then copy the signature back to your terminal.</p>

<div class="status" id="status">Ready.</div>

<button id="connect">Connect wallet</button>
<button id="sign" disabled>Sign typed data</button>

<p><label>Signature: <button id="copy" disabled>Copy</button></label></p>
<textarea id="sig" readonly placeholder="Signature will appear here after signing…"></textarea>

<script>
  const expectedAddress = ${JSON.stringify(input.address)};
  const typedData = ${typedDataJson};

  const $ = (id) => document.getElementById(id);
  const setStatus = (msg, cls) => {
    const el = $("status");
    el.textContent = msg;
    el.className = "status" + (cls ? " " + cls : "");
  };

  let connectedAddress = null;

  $("connect").addEventListener("click", async () => {
    if (!window.ethereum) {
      setStatus("No wallet found. Install MetaMask, Rabby, or Frame.", "err");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      connectedAddress = accounts[0];
      if (connectedAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
        setStatus(\`Connected \${connectedAddress}, but expected \${expectedAddress}. Switch accounts in your wallet.\`, "err");
        return;
      }
      setStatus(\`Connected: \${connectedAddress}\`, "ok");
      $("sign").disabled = false;
    } catch (err) {
      setStatus("Connect failed: " + (err.message || err), "err");
    }
  });

  $("sign").addEventListener("click", async () => {
    try {
      const sig = await window.ethereum.request({
        method: "eth_signTypedData_v4",
        params: [connectedAddress, JSON.stringify(typedData)],
      });
      $("sig").value = sig;
      $("copy").disabled = false;
      setStatus("Signed. Copy the signature back to your terminal.", "ok");
    } catch (err) {
      setStatus("Sign failed: " + (err.message || err), "err");
    }
  });

  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("sig").value);
      setStatus("Copied to clipboard.", "ok");
    } catch {
      $("sig").select();
      document.execCommand("copy");
      setStatus("Copied (fallback).", "ok");
    }
  });
</script>
`;
}

export async function writeSignerPage(
	input: WriteSignerPageInput,
): Promise<WriteSignerPageResult> {
	const filename = `mcp-pear-sign-${randomBytes(6).toString("hex")}.html`;
	const filePath = join(input.outDir, filename);
	const html = generateSignerHtml(input);
	await writeFile(filePath, html, "utf8");
	return { filePath, fileUrl: pathToFileURL(filePath).toString() };
}

function scriptSafeJson(value: unknown): string {
	// Replace `</` with `<\/` so an injected `</script>` in user data can't break out.
	return JSON.stringify(value).replace(/</g, "\\u003c");
}

function htmlEscape(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test signer-page 2>&1 | tail -10
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/cli/signer-page.ts tests/signer-page.test.ts
git commit -m "feat(setup): bundle static HTML signer page (no local server)"
```

---

## Task 8: `cli/prompts.ts`

**Files:**
- Create: `src/cli/prompts.ts`
- Test: `tests/prompts.test.ts`

Wraps `node:readline/promises` with validation loops and a `defaultTokenName` helper. Tests inject a fake `Interface`-shaped object.

- [ ] **Step 1: Write the failing test**

Create `tests/prompts.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
	askAddress,
	askSignature,
	askTokenName,
	askYesNo,
	defaultTokenName,
} from "../src/cli/prompts.js";

/** Fake readline-promises Interface that returns scripted answers. */
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
		const good = "0x" + "a".repeat(130);
		const rl = fakeReadline([good]);
		const sig = await askSignature(rl);
		expect(sig).toBe(good);
	});

	it("rejects short sigs and re-prompts", async () => {
		const good = "0x" + "f".repeat(130);
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test prompts 2>&1 | tail -10
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement**

Create `src/cli/prompts.ts`:

```typescript
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
	// Unknown input: fall back to default.
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test prompts 2>&1 | tail -10
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/cli/prompts.ts tests/prompts.test.ts
git commit -m "feat(setup): add prompts (address, signature, name, y/n)"
```

---

## Task 9: `cli/setup.ts` — orchestrator

**Files:**
- Create: `src/cli/setup.ts`

The orchestrator. Not unit-tested directly — its pieces all have coverage. Verified during manual smoke (Task 12).

- [ ] **Step 1: Implement**

Create `src/cli/setup.ts`:

```typescript
import { hostname, tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, exit, env, cwd } from "node:process";
import { getConfig, resetConfigForTests } from "../lib/config.js";
import { recoverEip712Signer, SignatureMismatchError } from "../lib/eip712.js";
import {
	getEip712Message,
	mintJwtEip712,
	mintApiKey,
} from "../services/auth.js";
import { PearClient } from "../services/pear-client.js";
import { HttpError } from "../lib/http.js";
import {
	askAddress,
	askSignature,
	askTokenName,
	askYesNo,
	defaultTokenName,
} from "./prompts.js";
import { writeSignerPage } from "./signer-page.js";
import { envFileStatus, writeEnvVars } from "./env-writer.js";

export async function runSetup(): Promise<void> {
	const rl = createInterface({ input: stdin, output: stdout });
	try {
		console.log("mcp-pear setup — mint a Pear Protocol API key for your wallet.\n");

		const cfg = getConfig();
		const baseUrl = cfg.baseUrl;
		const clientId = cfg.clientId;
		const timeoutMs = cfg.timeoutMs;

		const address = await askAddress(rl);
		const tokenName = await askTokenName(
			rl,
			defaultTokenName({ hostname: hostname(), now: new Date() }),
		);

		console.log("\nStep 1/4 — fetching sign-in message from Pear…");
		const typedData = await getEip712Message({ address, baseUrl, timeoutMs });
		console.log("  ✓ EIP-712 typed data received");

		console.log("\nStep 2/4 — sign in your wallet");
		const { filePath, fileUrl } = await writeSignerPage({
			outDir: tmpdir(),
			address,
			typedData,
		});
		console.log(`  Opening ${fileUrl}`);
		console.log("  (If your browser didn't open it, click the link above.)\n");
		openBrowser(fileUrl);

		// Re-prompt on signature mismatch until we get one that recovers correctly.
		let signature: string;
		while (true) {
			signature = await askSignature(rl);
			try {
				const recovered = await recoverEip712Signer({
					typedData,
					signature,
					expected: address,
				});
				console.log(
					`  ✓ Signature recovers to ${shorten(recovered)} (matches wallet)`,
				);
				break;
			} catch (err) {
				if (err instanceof SignatureMismatchError) {
					console.error(`  ✗ ${err.message}`);
					continue;
				}
				throw err;
			}
		}

		console.log("\nStep 3/4 — exchanging for API key");
		let jwt: string;
		try {
			const tokens = await mintJwtEip712({
				address,
				signature,
				baseUrl,
				clientId,
				timeoutMs,
			});
			jwt = tokens.accessToken;
			console.log("  ✓ JWT minted via /auth/login");
		} catch (err) {
			if (err instanceof HttpError && err.status === 401) {
				console.error(
					"  ✗ Pear rejected the signature. The sign-in message may have expired — re-run setup.",
				);
				exit(1);
			}
			throw err;
		}

		let apiKey: string;
		let apiKeyId: string;
		try {
			const result = await mintApiKey({
				jwt,
				name: tokenName,
				baseUrl,
				timeoutMs,
			});
			apiKey = result.apiKey;
			apiKeyId = result.id;
			console.log(`  ✓ API key minted via /api-keys (id: ${shorten(apiKeyId)})`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  ✗ API key minting failed: ${msg}`);
			console.error(
				`    JWT is still valid — you can use it directly:\n    PEAR_JWT=${jwt} mcp-pear`,
			);
			exit(0);
		}

		console.log("\nStep 4/4 — verifying");
		const verifiedOk = await verifyApiKey({
			apiKey,
			address,
			baseUrl,
			clientId,
			timeoutMs,
		});
		if (!verifiedOk) {
			console.error(
				"  ✗ Minted key didn't authenticate — this shouldn't happen. Report it.",
			);
			printKeyBlock({ apiKey, address });
			exit(1);
		}

		printKeyBlock({ apiKey, address });

		// Offer .env write.
		const status = await envFileStatus(cwd(), ["PEAR_API_KEY", "PEAR_ADDRESS"]);
		if (status.kind === "absent") {
			const yes = await askYesNo(rl, "Write these to ./.env?", true);
			if (yes) {
				await writeEnvVars(cwd(), {
					PEAR_API_KEY: apiKey,
					PEAR_ADDRESS: address,
				});
				console.log("  ✓ Wrote ./.env");
			}
		} else if (status.existingKeys.length === 0) {
			const yes = await askYesNo(rl, "Append to ./.env?", true);
			if (yes) {
				await writeEnvVars(cwd(), {
					PEAR_API_KEY: apiKey,
					PEAR_ADDRESS: address,
				});
				console.log("  ✓ Appended to ./.env");
			}
		} else {
			const list = status.existingKeys.join(", ");
			const yes = await askYesNo(
				rl,
				`./.env already has ${list}. Overwrite?`,
				false,
			);
			if (yes) {
				await writeEnvVars(cwd(), {
					PEAR_API_KEY: apiKey,
					PEAR_ADDRESS: address,
				});
				console.log(`  ✓ Updated ./.env (replaced ${list})`);
			}
		}

		console.log(
			"\nNext: add the same two env vars to your Claude Desktop config and restart Claude.",
		);
		console.log("See: https://npmjs.com/package/@marvelcodes/mcp-pear\n");
	} finally {
		rl.close();
	}
}

async function verifyApiKey(args: {
	apiKey: string;
	address: string;
	baseUrl: string;
	clientId: string;
	timeoutMs: number;
}): Promise<boolean> {
	const prev = {
		PEAR_API_KEY: env.PEAR_API_KEY,
		PEAR_ADDRESS: env.PEAR_ADDRESS,
		PEAR_JWT: env.PEAR_JWT,
		PEAR_REFRESH_TOKEN: env.PEAR_REFRESH_TOKEN,
	};
	env.PEAR_API_KEY = args.apiKey;
	env.PEAR_ADDRESS = args.address;
	env.PEAR_JWT = "";
	env.PEAR_REFRESH_TOKEN = "";
	resetConfigForTests();
	PearClient.resetForTests();
	try {
		const summary = await PearClient.getInstance().getAccountSummary();
		console.log(
			`  ✓ Authenticated call to /accounts succeeded (${summary.totalClosedTrades} closed trades)`,
		);
		return true;
	} catch {
		return false;
	} finally {
		// Restore env so subsequent code doesn't carry the side-effect.
		for (const [k, v] of Object.entries(prev)) {
			if (v === undefined) delete env[k];
			else env[k] = v;
		}
		resetConfigForTests();
		PearClient.resetForTests();
	}
}

function openBrowser(url: string): void {
	const cmd =
		process.platform === "darwin"
			? "open"
			: process.platform === "win32"
				? "cmd"
				: "xdg-open";
	const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
	try {
		spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
	} catch {
		// Browser failed to open — caller already printed the URL.
	}
}

function shorten(s: string): string {
	if (s.length <= 12) return s;
	return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function printKeyBlock(args: { apiKey: string; address: string }): void {
	const bar = "─".repeat(50);
	console.log(`\n${bar}`);
	console.log(`  PEAR_API_KEY=${args.apiKey}`);
	console.log(`  PEAR_ADDRESS=${args.address}`);
	console.log(`${bar}\n`);
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm run build 2>&1 | tail -10
```

Expected: clean. If TS complains about the `resetForTests` calls, that's because they're marked `@internal`. Acceptable — the leading-underscore convention is just a hint, not enforced.

- [ ] **Step 3: Lint**

```bash
pnpm run lint 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 4: Run full test suite**

```bash
pnpm test 2>&1 | tail -10
```

Expected: all green (no new unit tests for setup.ts itself).

- [ ] **Step 5: Commit**

```bash
git add src/cli/setup.ts
git commit -m "feat(setup): orchestrator wires prompts, signer page, auth, .env"
```

---

## Task 10: `src/index.ts` — dispatcher

**Files:**
- Modify: `src/index.ts`

Branch on `process.argv[2]`. Dynamic-import the setup module so it only loads on the setup path.

- [ ] **Step 1: Rewrite `src/index.ts`**

Replace the entire file with:

```typescript
#!/usr/bin/env node
import { APP_NAME, APP_VERSION } from "./constants.js";

const cmd = process.argv[2];

if (cmd === "setup") {
	const { runSetup } = await import("./cli/setup.js");
	await runSetup();
	process.exit(0);
}

if (cmd === "--help" || cmd === "-h") {
	printHelp();
	process.exit(0);
}

if (cmd === "--version" || cmd === "-v") {
	console.log(`${APP_NAME} ${APP_VERSION}`);
	process.exit(0);
}

await startServer();

async function startServer(): Promise<void> {
	const { FastMCP } = await import("fastmcp");
	const tools = await import("./tools/index.js");
	const server = new FastMCP({
		name: APP_NAME,
		version: APP_VERSION as `${number}.${number}.${number}`,
	});
	server.addTool(tools.getHealthTool);
	server.addTool(tools.listMarketsTool);
	server.addTool(tools.getActiveMarketsTool);
	server.addTool(tools.getPairRatioTool);
	server.addTool(tools.getAccountSummaryTool);
	server.addTool(tools.getOpenPositionsTool);
	server.addTool(tools.getOpenOrdersTool);
	server.addTool(tools.getTradeHistoryTool);
	server.addTool(tools.getTwapOrdersTool);
	server.addTool(tools.getPortfolioTool);
	await server.start({ transportType: "stdio" });
}

function printHelp(): void {
	console.log(`${APP_NAME} ${APP_VERSION}

Usage:
  mcp-pear              Start the MCP server over stdio (default).
  mcp-pear setup        Mint a Pear API key for your wallet (interactive).
  mcp-pear --version    Print version.
  mcp-pear --help       Print this help.

Environment:
  PEAR_API_KEY          Pear API key (single-user mode).
  PEAR_ADDRESS          Wallet address bound to the API key (required with PEAR_API_KEY).
  PEAR_JWT              Pre-minted access token (orchestrator mode).
  PEAR_REFRESH_TOKEN    Optional refresh token (pairs with PEAR_JWT).
  PEAR_API_BASE_URL     Override Pear API host (default https://hl-v2.pearprotocol.io).
  PEAR_API_TIMEOUT_MS   Per-request timeout (default 10000).
  PEAR_CLIENT_ID        Client identifier (default APITRADER).

Docs: https://npmjs.com/package/@marvelcodes/mcp-pear
`);
}
```

- [ ] **Step 2: Build**

```bash
pnpm run build 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 3: Sanity-check `--version` and `--help`**

```bash
node dist/index.js --version
node dist/index.js --help | head -3
```

Expected: prints version, then the help banner.

- [ ] **Step 4: Sanity-check default server path still boots**

```bash
PEAR_JWT='dummy' node dist/index.js < /dev/null & PID=$!; sleep 1; if kill -0 $PID 2>/dev/null; then echo "✓ server running"; kill $PID; else echo "✗ server died"; fi
```

Expected: `✓ server running`.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test 2>&1 | tail -10
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat(setup): dispatcher branches on argv (setup / --help / --version / server)"
```

---

## Task 11: Smoke test — `mintApiKey` against live API

**Files:**
- Modify: `tests/smoke.test.ts`

- [ ] **Step 1: Append smoke test**

Append inside the existing `describe.skipIf(!HAS_KEY)("smoke (live API)", () => { ... })` block, OR add a new sibling describe gated on `PEAR_JWT`:

```typescript
import { mintApiKey } from "../src/services/auth.js";

const HAS_JWT = !!process.env.PEAR_JWT;

describe.skipIf(!HAS_JWT)("smoke (live mintApiKey)", () => {
	it("mints a new API key labelled 'smoke-test'", async () => {
		const result = await mintApiKey({
			jwt: process.env.PEAR_JWT!,
			name: `smoke-test-${Date.now()}`,
			baseUrl: "https://hl-v2.pearprotocol.io",
			timeoutMs: 15000,
		});
		expect(result.id).toMatch(/.+/);
		expect(result.apiKey).toMatch(/.+/);
	}, 30000);
});
```

> **Note:** this test mints a real API key on every live smoke run. The key is labelled `smoke-test-<timestamp>` so it can be filtered/revoked manually via Pear's UI when one exists.

- [ ] **Step 2: Verify the test is properly skipped without the env var**

```bash
pnpm test smoke 2>&1 | tail -10
```

Expected: all skipped — no failures.

- [ ] **Step 3: Commit**

```bash
git add tests/smoke.test.ts
git commit -m "test(setup): live smoke for mintApiKey gated on PEAR_JWT"
```

---

## Task 12: Manual smoke + README + changeset

**Files:**
- Modify: `README.md`
- Create: `.changeset/setup-cli.md`

- [ ] **Step 1: Manual setup dry-run** (do not paste a real signature — abort at the prompt)

```bash
pnpm run build
node dist/index.js setup
```

Walk through:
1. Address prompt — type a known address.
2. Token name — accept default.
3. Confirm "EIP-712 typed data received" prints.
4. Confirm browser opens to a `file://` URL.
5. View the page in the browser, confirm wallet-connect button works (don't sign — `Ctrl+C` to abort).

Expected: every step prints its `✓`/`✗` line cleanly, prompts re-loop on bad input.

- [ ] **Step 2: Update README — new Getting Started section**

In `README.md`, between the "Installation" and "Configuration" sections, insert:

```markdown
## Getting started

The fastest way to get authenticated tools working:

```bash
npx -y @marvelcodes/mcp-pear setup
```

This walks you through a one-time wallet signature in your browser, mints a Pear API key, and (optionally) writes the resulting `PEAR_API_KEY` + `PEAR_ADDRESS` to a `.env` file. Paste the same two values into your Claude Desktop config and restart Claude.

> Already have a JWT from app.pear.garden? Skip `setup` and use the **JWT pass-through** mode below.
```

The existing "Configuration" section stays as-is — it documents all three modes and is the right reference once the user is set up.

- [ ] **Step 3: Add changeset**

Create `.changeset/setup-cli.md`:

```markdown
---
"@marvelcodes/mcp-pear": patch
---

Add `mcp-pear setup` subcommand: interactive CLI that mints a Pear Protocol API key via wallet signature (EIP-712), with a bundled static HTML signer page (no local server). Closes the v0.1 onboarding gap where users had to extract a JWT from browser DevTools to use authenticated tools.
```

- [ ] **Step 4: Final verification**

```bash
pnpm run build && pnpm run lint && pnpm test 2>&1 | tail -10
```

Expected: all clean.

- [ ] **Step 5: Commit**

```bash
git add README.md .changeset/setup-cli.md
git commit -m "docs(setup): README onboarding section + changeset for v0.1.1"
```

---

## Task 13: Publish v0.1.1

**Files:**
- Modify: `package.json` (version bump via changeset)

- [ ] **Step 1: Consume the changeset (bumps 0.1.0 → 0.1.1)**

```bash
pnpm exec changeset version 2>&1 | tail -10
cat package.json | grep '"version"'
```

Expected: `"version": "0.1.1"`. The `.changeset/setup-cli.md` file is deleted and a `CHANGELOG.md` entry is added (or created).

- [ ] **Step 2: Stage the version bump and changelog**

```bash
git add package.json CHANGELOG.md .changeset/
git status
```

Expected: `package.json`, `CHANGELOG.md` modified/created; `.changeset/setup-cli.md` deleted.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: release v0.1.1"
```

- [ ] **Step 4: Tag**

```bash
git tag v0.1.1
```

- [ ] **Step 5: Build + publish to npm**

```bash
pnpm run build
npm publish --access public
```

Expected: tarball uploads, npm replies `+ @marvelcodes/mcp-pear@0.1.1`.

> **2FA note:** Pear's npm account requires OTP-based 2FA. If this command runs inside an automated context, use `--otp=<code>` from your authenticator app. If running interactively, npm will prompt or open a browser flow.

- [ ] **Step 6: Push to GitHub**

```bash
git push origin main && git push origin v0.1.1
```

Expected: both push successfully.

- [ ] **Step 7: Verify on npm**

```bash
npm view @marvelcodes/mcp-pear@0.1.1 version
```

Expected: prints `0.1.1` (may take a minute to propagate after publish).

---

## Self-review checklist

- ✅ Spec coverage: §1 goal → covered by overall plan; §2 verified facts → encoded in Task 3-5 bodies; §3 user flow → matches setup.ts in Task 9; §4 architecture → file map matches; §5 data flow → setup.ts orchestrator follows it; §6 error handling → setup.ts branches cover every row; §7 signer page → Task 7; §8 testing → Tasks 1, 6, 7, 8 cover unit; Task 11 covers smoke; §9 deps → Task 0; §10 docs → Task 12.
- ✅ No placeholders in any step.
- ✅ Type consistency: `JwtTokens` (existing), `AuthMessage`, `ApiKeyResponse`, `EnvFileStatus`, `ReadlineLike`, `WriteSignerPageResult` all defined where first used.
- ✅ The fixture-signature note in Task 1 explicitly tells the engineer to regenerate the signature with a real script — no fake hex is silently used.
- ✅ Every commit message follows the existing conventional-commit style.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-mcp-pear-setup-cli.md`.**
