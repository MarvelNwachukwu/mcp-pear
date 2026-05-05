# JWT Pass-Through Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `PEAR_JWT` (and optional `PEAR_REFRESH_TOKEN`) auth mode so external orchestrators (e.g. Telegram bots) can mint JWTs themselves and inject them into mcp-pear without exposing API keys.

**Architecture:** Add two new env-var fields to `PearConfig`. `PearClient` constructor seeds `accessToken`/`refreshToken` from those fields. The existing `ensureJwt()` ladder (cached → refresh → mint) handles the new mode transparently because step 1 (cached) returns the seeded JWT. On JWT expiry with no API-key fallback, surface a specific `ConfigError` so the orchestrator knows to re-mint.

**Tech Stack:** TypeScript strict + ES2022, fastmcp, vitest, Biome — same as v0.1.

**Spec:** `docs/superpowers/specs/2026-05-05-mcp-pear-design.md` §5, §7, §10 (updated commit `e16f582`).

**Pre-flight:** Repo at `/Users/0xmarvel/.superset/projects/mcp-pear`. Branch `main`. Current HEAD `e16f582` (after spec update). Tag `v0.1.0` currently at `527f7b4` — will be re-pointed to the final commit of this plan after it lands. 52 tests passing + 3 skipped.

---

## File Structure

```
src/
├─ lib/
│  └─ config.ts              # MODIFIED: add jwt, refreshToken fields
└─ services/
   └─ pear-client.ts         # MODIFIED: constructor seeds tokens; acquireTokens surfaces orchestrator error
tests/
├─ config.test.ts            # MODIFIED: add 2 tests (reads PEAR_JWT, reads PEAR_REFRESH_TOKEN)
└─ auth.test.ts              # MODIFIED: add new describe block with 3 ladder tests
.env.example                 # MODIFIED: restructure into three sections by mode
README.md                    # MODIFIED: replace Configuration section
examples/
└─ telegram-bot-usage.ts     # CREATE: new example showing orchestrator pattern
```

Two atomic commits:
1. **Task 1** (one commit, `feat(auth):`) — code + tests for the three auth modes
2. **Task 2** (one commit, `docs(auth):`) — README, .env.example, telegram-bot example

---

## Task 1: Implement JWT pass-through in config + PearClient

**Files:**
- Modify: `src/lib/config.ts`
- Modify: `tests/config.test.ts`
- Modify: `src/services/pear-client.ts`
- Modify: `tests/auth.test.ts`

### TDD discipline: tests added FIRST in each step pair, then implementation.

- [ ] **Step 1: Add 2 failing tests to `tests/config.test.ts` for new env vars**

Add `delete process.env.PEAR_JWT;` and `delete process.env.PEAR_REFRESH_TOKEN;` to the existing `beforeEach` block. Then append these tests to the existing `describe("config", () => { ... })` block, before its closing `});`:

```ts
	it("reads PEAR_JWT from env", () => {
		process.env.PEAR_JWT = "preminted-access-token";
		expect(getConfig().jwt).toBe("preminted-access-token");
	});

	it("reads PEAR_REFRESH_TOKEN from env", () => {
		process.env.PEAR_REFRESH_TOKEN = "preminted-refresh-token";
		expect(getConfig().refreshToken).toBe("preminted-refresh-token");
	});

	it("jwt and refreshToken default to undefined when env unset", () => {
		const cfg = getConfig();
		expect(cfg.jwt).toBeUndefined();
		expect(cfg.refreshToken).toBeUndefined();
	});
```

- [ ] **Step 2: Run config tests — expect failure**

Run: `pnpm test config`
Expected: 3 new tests fail because `cfg.jwt` and `cfg.refreshToken` are `undefined` (passes the third test only) but TypeScript will complain that `jwt`/`refreshToken` aren't on `PearConfig`. The first two tests fail with `TypeError: Cannot read properties of undefined`.

If you see TypeScript errors instead of test failures, that confirms the interface needs updating before the tests can run. Proceed to Step 3.

- [ ] **Step 3: Modify `src/lib/config.ts` to add `jwt` and `refreshToken`**

Find the `PearConfig` interface and add two fields:

```ts
export interface PearConfig {
	apiKey: string | undefined;
	address: string | undefined;
	jwt: string | undefined;
	refreshToken: string | undefined;
	baseUrl: string;
	timeoutMs: number;
	clientId: string;
	requireApiKey(toolName: string): string;
	requireAddress(toolName: string): string;
}
```

(Keep `requireApiKey` and `requireAddress` exactly as they are. The new fields are read-only — no `requireJwt` method needed.)

In `getConfig()`, after the existing `address = ...` line and before the `cached = { ... }` assignment, add:

```ts
const jwt = process.env.PEAR_JWT?.trim() || undefined;
const refreshToken = process.env.PEAR_REFRESH_TOKEN?.trim() || undefined;
```

Then in the `cached = { ... }` object literal, add `jwt,` and `refreshToken,` alongside the other fields. The full literal should look like:

```ts
cached = {
	apiKey,
	address,
	jwt,
	refreshToken,
	baseUrl,
	timeoutMs,
	clientId,
	requireApiKey(toolName: string) { /* unchanged */ },
	requireAddress(toolName: string) { /* unchanged */ },
};
```

- [ ] **Step 4: Run config tests — expect pass**

Run: `pnpm test config`
Expected: All config tests pass (5 original + 3 address-related from previous task + 3 new = 11 tests total).

- [ ] **Step 5: Append new ladder describe block to `tests/auth.test.ts`**

The existing `tests/auth.test.ts` has a top-level imports section, three `describe` blocks (`mintJwt`, `refreshJwt`, `PearClient.ensureJwt ladder`), and ends with the closing `});` of the third describe. Append AFTER that closing `});`:

```ts

describe("PearClient with PEAR_JWT (pass-through mode)", () => {
	const ORIGINAL_ENV = { ...process.env };
	const fetchMockJ = vi.fn();
	beforeEach(() => {
		fetchMockJ.mockReset();
		vi.stubGlobal("fetch", fetchMockJ);
		process.env = { ...ORIGINAL_ENV, PEAR_JWT: "preminted-AT" };
		delete process.env.PEAR_API_KEY;
		delete process.env.PEAR_ADDRESS;
		delete process.env.PEAR_REFRESH_TOKEN;
		resetConfigForTests();
		PearClient.resetForTests();
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		process.env = ORIGINAL_ENV;
		resetConfigForTests();
		PearClient.resetForTests();
	});

	it("uses PEAR_JWT directly without minting", async () => {
		const client = PearClient.getInstance();
		const token = await client.ensureJwtForTests();
		expect(token).toBe("preminted-AT");
		expect(fetchMockJ).not.toHaveBeenCalled();
	});

	it("refreshes when PEAR_JWT is invalidated and PEAR_REFRESH_TOKEN is set", async () => {
		process.env.PEAR_REFRESH_TOKEN = "preminted-RT";
		resetConfigForTests();
		PearClient.resetForTests();

		fetchMockJ.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				accessToken: "refreshed-AT",
				refreshToken: "refreshed-RT",
			}),
		});

		const client = PearClient.getInstance();
		const initial = await client.ensureJwtForTests();
		expect(initial).toBe("preminted-AT");
		client.invalidateAccessTokenForTests();
		const fresh = await client.ensureJwtForTests();
		expect(fresh).toBe("refreshed-AT");

		const [url, init] = fetchMockJ.mock.calls[0];
		expect(url).toContain("/auth/refresh");
		expect(JSON.parse(init.body)).toEqual({ refreshToken: "preminted-RT" });
	});

	it("throws orchestrator error when JWT expires and no fallback configured", async () => {
		const client = PearClient.getInstance();
		const initial = await client.ensureJwtForTests();
		expect(initial).toBe("preminted-AT");
		client.invalidateAccessTokenForTests();
		await expect(client.ensureJwtForTests()).rejects.toThrow(
			/JWT expired.*orchestrator must mint a new one/,
		);
		expect(fetchMockJ).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 6: Run auth tests — expect failure on new block, existing pass**

Run: `pnpm test auth`
Expected: 7 existing tests pass; 3 new tests fail. The first new test (`uses PEAR_JWT directly without minting`) fails because the constructor doesn't yet seed `accessToken` from `config.jwt`. Proceed to Step 7.

- [ ] **Step 7: Modify `src/services/pear-client.ts` constructor to seed tokens**

Find the existing private constructor:

```ts
private constructor(private readonly config: PearConfig) {}
```

Replace with:

```ts
private constructor(private readonly config: PearConfig) {
	this.accessToken = config.jwt ?? null;
	this.refreshToken = config.refreshToken ?? null;
}
```

This is a one-shot seed at construction. The `ensureJwt()` ladder is unchanged — it'll find the seeded `accessToken` in step 1 (cached path) and return it.

- [ ] **Step 8: Modify `acquireTokens()` to surface orchestrator error**

Find the existing `acquireTokens()` method. It currently looks like:

```ts
private async acquireTokens(): Promise<JwtTokens> {
	if (this.refreshToken) {
		try {
			return await refreshJwt({
				refreshToken: this.refreshToken,
				baseUrl: this.config.baseUrl,
				timeoutMs: this.config.timeoutMs,
			});
		} catch {
			this.refreshToken = null;
		}
	}
	const apiKey = this.config.requireApiKey("authenticated_tool");
	return await mintJwt({
		apiKey,
		address: this.config.requireAddress("authenticated_tool"),
		baseUrl: this.config.baseUrl,
		clientId: this.config.clientId,
		timeoutMs: this.config.timeoutMs,
	});
}
```

Insert a new check between the refresh-attempt block and the `requireApiKey` call. The full updated method:

```ts
private async acquireTokens(): Promise<JwtTokens> {
	if (this.refreshToken) {
		try {
			return await refreshJwt({
				refreshToken: this.refreshToken,
				baseUrl: this.config.baseUrl,
				timeoutMs: this.config.timeoutMs,
			});
		} catch {
			this.refreshToken = null;
		}
	}
	if (this.config.jwt && !this.config.apiKey) {
		throw new ConfigError(
			"JWT expired; the orchestrator must mint a new one and restart mcp-pear.",
		);
	}
	const apiKey = this.config.requireApiKey("authenticated_tool");
	return await mintJwt({
		apiKey,
		address: this.config.requireAddress("authenticated_tool"),
		baseUrl: this.config.baseUrl,
		clientId: this.config.clientId,
		timeoutMs: this.config.timeoutMs,
	});
}
```

You'll also need to import `ConfigError`. At the top of `pear-client.ts`, add it to the existing config import:

```ts
import { ConfigError, type PearConfig, getConfig } from "../lib/config.js";
```

(If `ConfigError` is already imported, leave the import line alone.)

- [ ] **Step 9: Run all tests — expect pass**

Run: `pnpm test`
Expected: All tests pass — 5 original config + 3 address-related + 3 new config = 11 config tests; 7 existing auth + 3 new ladder = 10 auth tests; format 16; http 14; pair-ratio 7. Total: 58 passed, 3 skipped (61 total).

If the second new test (refresh path) fails because `refreshJwt` was called but `acquireTokens` exited with the orchestrator error first, you have an ordering bug — the refresh-attempt block must run BEFORE the orchestrator-error check. Verify Step 8.

- [ ] **Step 10: Run tsc + lint**

Run: `pnpm exec tsc --noEmit`
Expected: No errors.

Run: `pnpm run lint`
Expected: Exit 0. Biome may auto-format the changes. If it does, accept the format and re-run lint to confirm clean.

- [ ] **Step 11: Run full build to confirm no regressions**

Run: `pnpm run build`
Expected: `dist/index.js` produced cleanly.

Run: `node dist/index.js < /dev/null`
Expected: Exit 0 (server starts, exits when stdin closes).

Verify all 10 tools still register:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js 2>/dev/null | head -c 3000
```
Expected: All 10 tool names appear in the response.

- [ ] **Step 12: Commit Task 1**

```bash
git add src/lib/config.ts src/services/pear-client.ts tests/config.test.ts tests/auth.test.ts
git commit -m "feat(auth): add PEAR_JWT pass-through mode to auth ladder"
```

**No `Co-Authored-By` or `Generated with Claude Code` trailers.**

Verify the commit:
```bash
git show --stat HEAD
```
Expected: Exactly 4 files changed, ~50-90 insertions, ~5-10 deletions. Files: `src/lib/config.ts`, `src/services/pear-client.ts`, `tests/auth.test.ts`, `tests/config.test.ts`.

---

## Task 2: Update docs (.env.example, README, examples/telegram-bot-usage.ts)

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Create: `examples/telegram-bot-usage.ts`

No tests added for this task (documentation only).

- [ ] **Step 1: Replace `.env.example` content**

Overwrite `.env.example` with:

```
# mcp-pear supports three auth modes — see README for details.
#
# Mode 1: JWT pass-through (recommended for multi-tenant orchestrators).
# The orchestrator (e.g. Telegram bot) mints the JWT externally and passes it in.
# If PEAR_JWT is set, PEAR_API_KEY/PEAR_ADDRESS are ignored.
PEAR_JWT=
PEAR_REFRESH_TOKEN=

# Mode 2: API key + wallet address (single-user / Claude Desktop).
# Used only when PEAR_JWT is not set. Both fields are required for authenticated tools.
PEAR_API_KEY=
PEAR_ADDRESS=

# Common settings (all optional, defaults shown).
PEAR_API_BASE_URL=https://hl-v2.pearprotocol.io
PEAR_API_TIMEOUT_MS=10000
PEAR_CLIENT_ID=APITRADER
```

- [ ] **Step 2: Replace the Configuration section in `README.md`**

Find the existing `## Configuration` section in `README.md`. It currently contains a single env-var table. Replace the entire section (from the `## Configuration` heading through the end of the table, but before the next `## ` heading) with:

```markdown
## Configuration

mcp-pear supports three auth modes. The first one whose env vars are set wins at first authenticated tool call.

### Mode 1 — JWT pass-through (recommended for multi-tenant orchestrators)

For Telegram bots and other orchestrators that mint JWTs externally (e.g. via Privy, EIP-712, or any flow Pear supports). mcp-pear treats the JWT as opaque and never calls `/auth/login`.

| Env var | Required | Description |
|---|---|---|
| `PEAR_JWT` | yes | Pre-minted access token. When set, PEAR_API_KEY/PEAR_ADDRESS are ignored. |
| `PEAR_REFRESH_TOKEN` | no | If set, mcp-pear self-refreshes once when PEAR_JWT expires mid-session. Otherwise the orchestrator must re-mint and respawn the subprocess. |

When `PEAR_JWT` expires and no refresh token is available, authenticated tools return:
> `JWT expired; the orchestrator must mint a new one and restart mcp-pear.`

See [`examples/telegram-bot-usage.ts`](./examples/telegram-bot-usage.ts) for the orchestrator pattern.

### Mode 2 — API key + wallet address (single-user / Claude Desktop)

| Env var | Required | Description |
|---|---|---|
| `PEAR_API_KEY` | for auth tools | Your Pear API key. |
| `PEAR_ADDRESS` | for auth tools | The wallet address bound to the API key (`0x...`). |

mcp-pear mints the JWT itself by calling `POST /auth/login`. Both fields are required because the OpenAPI spec requires `address` in the request body.

### Public-only mode (no auth)

The four public tools (`get_health`, `list_markets`, `get_active_markets`, `get_pair_ratio`) work without any auth env vars. Authenticated tools return a `ConfigError` describing which env var is missing.

### Common settings (optional)

| Env var | Default | Description |
|---|---|---|
| `PEAR_API_BASE_URL` | `https://hl-v2.pearprotocol.io` | Pear API host. |
| `PEAR_API_TIMEOUT_MS` | `10000` | Per-request timeout. |
| `PEAR_CLIENT_ID` | `APITRADER` | Client identifier sent to `/auth/login`. |
```

Leave all other README sections untouched.

- [ ] **Step 3: Update the Claude Desktop usage snippet in `README.md`**

Find the existing Claude Desktop config snippet (under `## Claude Desktop usage`). Update the `env` block to show both `PEAR_API_KEY` and `PEAR_ADDRESS`:

```json
{
  "mcpServers": {
    "pear": {
      "command": "npx",
      "args": ["-y", "@marvelcodes/mcp-pear"],
      "env": {
        "PEAR_API_KEY": "your-pear-api-key-here",
        "PEAR_ADDRESS": "0xYourWalletAddress"
      }
    }
  }
}
```

(If the snippet already shows both keys from the previous address-fix commit, leave it alone.)

- [ ] **Step 4: Create `examples/telegram-bot-usage.ts`**

```ts
// Example: integrating mcp-pear into a Telegram bot or other multi-tenant orchestrator.
//
// The orchestrator owns user authentication (e.g. via Pear's onboarding wizard at
// app.pear.garden/connect/telegram?code=<code>, or any custom EIP-712/Privy/wallet flow)
// and stores per-user JWTs in its database. When the bot needs to call a Pear API on
// behalf of a user, it spawns mcp-pear as a subprocess with the user's JWT injected via
// PEAR_JWT — mcp-pear treats the JWT as opaque and never touches /auth/login.
//
// This example is illustrative; the actual MCP client integration depends on your stack
// (FastMCP client, raw stdio JSON-RPC, ADK-TS McpToolset, etc.).

import { spawn } from "node:child_process";

interface UserCredentials {
	userId: string;
	pearJwt: string;
	pearRefreshToken?: string;
}

/**
 * Spawns an mcp-pear subprocess with the given user's JWT pre-loaded.
 * The bot is responsible for mintting/refreshing JWTs out-of-band; mcp-pear is just
 * a credential consumer in this mode.
 */
export function spawnMcpPearForUser(creds: UserCredentials) {
	const child = spawn("npx", ["-y", "@marvelcodes/mcp-pear"], {
		stdio: ["pipe", "pipe", "inherit"],
		env: {
			...process.env,
			PEAR_JWT: creds.pearJwt,
			...(creds.pearRefreshToken
				? { PEAR_REFRESH_TOKEN: creds.pearRefreshToken }
				: {}),
		},
	});
	return child;
}

// Example usage (pseudocode — your bot framework drives the MCP client):
//
//   const user = await db.users.findOne({ telegramId: ctx.from.id });
//   const child = spawnMcpPearForUser({
//     userId: user.id,
//     pearJwt: user.pearJwt,
//     pearRefreshToken: user.pearRefreshToken,
//   });
//   const mcpClient = new McpClient(child.stdin, child.stdout);
//   const result = await mcpClient.callTool("get_portfolio", {});
//   await ctx.reply(result.content[0].text);
//
// When PEAR_JWT expires:
//   - If PEAR_REFRESH_TOKEN was provided, mcp-pear self-refreshes once and continues.
//   - Otherwise mcp-pear surfaces "JWT expired; the orchestrator must mint a new one
//     and restart mcp-pear." — your bot intercepts this, refreshes the user's JWT
//     via Pear's auth flow, and respawns the subprocess.
```

- [ ] **Step 5: Verify build still passes**

Run: `pnpm exec tsc --noEmit`
Expected: Clean. (Note: `examples/` is excluded from the source `include` in tsconfig, so the new example file won't be type-checked by tsc — it's documentation. The existing `examples/adk-ts-usage.ts` follows the same pattern.)

Run: `pnpm run lint`
Expected: Exit 0.

Run: `pnpm test`
Expected: All tests still pass (counts unchanged from Task 1).

- [ ] **Step 6: Commit Task 2**

```bash
git add .env.example README.md examples/telegram-bot-usage.ts
git commit -m "docs(auth): document three auth modes and add Telegram-bot example"
```

No Claude trailers.

Verify:
```bash
git show --stat HEAD
```
Expected: 3 files changed.

---

## Task 3: Re-tag v0.1.0 to include the JWT pass-through fixes

**Files:** none — git operation only.

The `v0.1.0` tag currently points to commit `527f7b4` (the address-in-login fix). Since the JWT pass-through is part of the v0.1.0 release (a meaningful auth-flexibility addition before first npm publish), re-point the tag to the new HEAD.

- [ ] **Step 1: Re-tag**

```bash
git tag -d v0.1.0
git tag v0.1.0
```

- [ ] **Step 2: Verify**

```bash
git tag -l v0.1.0
git rev-parse v0.1.0
git log --oneline -3
```

Expected: Tag exists; SHA matches the latest commit (Task 2's commit); recent log shows Task 2 (`docs(auth): ...`), Task 1 (`feat(auth): ...`), spec update (`docs: extend spec with three auth modes`).

- [ ] **Step 3: Final verification suite**

```bash
pnpm install
pnpm run lint
pnpm exec tsc --noEmit
pnpm test
pnpm run build
node dist/index.js < /dev/null
```

All must pass.

---

## Self-Review Notes (already applied)

- **Spec coverage** — §2 (auth model), §5 (ladder), §7 (error model), §10 (config) all have implementing tasks. §6 (HTTP layer), §8 (tools), §9 (output) are unchanged by this plan, as expected.
- **Placeholder scan** — all code blocks are complete. No "TBD" or "Add appropriate handling" patterns.
- **Type consistency** — `PearConfig` interface has `jwt`, `refreshToken` (Task 1 Step 3) which Task 1 Step 7 reads via `config.jwt` and `config.refreshToken`. `requireApiKey`/`requireAddress` signatures unchanged. The orchestrator-error message string is identical between the spec, Task 1 Step 8 implementation, and Task 1 Step 5 test regex.

## Notes for the executing engineer

- **TDD strictly:** Each test step (`Step 1`, `Step 5`) MUST run-and-fail BEFORE the implementation step that follows it. Don't write the implementation first.
- **Atomic commits:** Task 1 is one commit covering all 4 modified files. Don't split. Same for Task 2 (one commit, 3 files).
- **No Claude attribution:** No `Co-Authored-By: Claude` or `Generated with Claude Code` trailers in commit messages. The user enforces this via attribution settings; respect it manually as well.
- **The orchestrator-error path is the most error-prone:** the order of checks in `acquireTokens` matters. Refresh-attempt MUST run before the orchestrator-error check, otherwise the second new test (`refreshes when PEAR_JWT is invalidated and PEAR_REFRESH_TOKEN is set`) will fail because the error fires before the refresh attempt.
- **Don't speculatively change the `ensureJwt` ladder.** The whole point of this design is that the ladder is unchanged — JWT pass-through works because the constructor seeds `accessToken`, and step 1 (cached path) returns it. If you find yourself adding a new ladder rung, stop.
