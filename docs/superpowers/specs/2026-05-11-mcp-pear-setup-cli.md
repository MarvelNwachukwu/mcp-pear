# mcp-pear v0.1.1 — `setup` CLI Design

**Status:** approved 2026-05-11
**Scope:** add `npx @marvelcodes/mcp-pear setup` — a one-shot CLI that mints a Pear Protocol API key for the caller's wallet without requiring browser DevTools
**Audience:** implementation plan author + future contributors

---

## 1. Goal

Close the v0.1 onboarding gap.

Today, only developers who can read a JWT out of `app.pear.garden`'s `localStorage` or network panel can use mcp-pear's authenticated tools. Pear's public API doesn't (yet) ship a UI for end-users to mint API keys; the API endpoints exist (`POST /api-keys`) but require a JWT that must be obtained via EIP-712 wallet signature.

`mcp-pear setup` walks the user through the EIP-712 → JWT → API key flow with a bundled static HTML signer page, ending with two environment variables ready to paste into Claude Desktop's config.

This is a v0.1.x patch — non-breaking, additive only. No changes to the runtime MCP server's behavior, tools, or env-var contract.

---

## 2. Verified facts about Pear's API-key flow

Confirmed by reading `docs.pearprotocol.io/api-integration/api-specification/{authentication,api-keys}.md` on 2026-05-11.

**To mint an API key, three calls in order:**

1. `GET /auth/eip712-message?address=<0x…>` → returns the EIP-712 typed data the user must sign. Response shape (inferred from OpenAPI):

   ```json
   {
     "domain":   { "name": "...", "version": "...", "chainId": <n>, "verifyingContract": "0x..." },
     "types":    { "EIP712Domain": [...], "<PrimaryType>": [...] },
     "primaryType": "<PrimaryType>",
     "message":  { "...": "..." }
   }
   ```

2. `POST /auth/login` with the signature:

   ```json
   {
     "method":  "eip712",
     "address": "0x...",
     "clientId": "APITRADER",
     "details": { "signature": "0x...130 hex chars..." }
   }
   ```

   → `{ accessToken, refreshToken, ... }` (same shape as the existing `api_key` method response).

3. `POST /api-keys` with `Authorization: Bearer <accessToken>`:

   ```json
   { "name": "mcp-pear-<hostname>-<yyyy-mm-dd>" }
   ```

   → `{ id, apiKey, name, createdAt }`. The `apiKey` field is the secret — only returned once, must be captured immediately.

**Known unknowns to resolve during implementation:**

- The exact `primaryType` and message body returned by `/auth/eip712-message` (the OpenAPI sample is generic). Implementation must inspect the live response and pass it through unchanged to the signer page — we do not interpret the schema, only forward it.
- Whether `clientId` for `setup` should match the runtime server (`APITRADER` by default, overridable via `PEAR_CLIENT_ID`). Default: use the same env-var ladder as the runtime so a single config covers both. The `PEARPROTOCOLUI` clientId observed in the user's JWT during the v0.1 testing session was bound to `appId: "eip712"` and works against `/auth/login`; `APITRADER` is what the OpenAPI advertises. We default to `APITRADER` and accept `PEAR_CLIENT_ID` for override.

---

## 3. User flow

```
$ npx @marvelcodes/mcp-pear setup

mcp-pear setup — mint a Pear Protocol API key for your wallet.

Wallet address: 0xeb6E3C2522b78bb0a5c65198eB35566b43171137
Token name (optional, e.g. "claude desktop"): mcp-pear local

Step 1/4 — fetching sign-in message from Pear…
  ✓ EIP-712 typed data received

Step 2/4 — sign in your wallet
  Opening file:///private/var/folders/…/mcp-pear-sign.html
  (If your browser didn't open it, click the link above.)

  Once you've signed in the browser, paste the signature here:
  > 0x4f7e…a93b

  ✓ Signature recovers to 0xeb6E…1137 (matches wallet)

Step 3/4 — exchanging for API key
  ✓ JWT minted via /auth/login
  ✓ API key minted via /api-keys (id: ak_2yT…)

Step 4/4 — verifying
  ✓ Authenticated call to /accounts succeeded (17 closed trades)

──────────────────────────────────────────────────
  PEAR_API_KEY=pk_live_…
  PEAR_ADDRESS=0xeb6E3C2522b78bb0a5c65198eB35566b43171137
──────────────────────────────────────────────────

Write these to ./.env? [Y/n] y
  ✓ Wrote ./.env

Next: add the same two env vars to your Claude Desktop config and
restart Claude. See: https://npmjs.com/package/@marvelcodes/mcp-pear
```

**Idempotency:** running `setup` twice for the same wallet mints two distinct API keys. Old keys remain valid until explicitly revoked via Pear's API or UI. We do not list, name-collision-check, or revoke existing keys — that's a v0.2+ concern.

---

## 4. Architecture

```
src/
├── index.ts                       # binary entry — branches on argv
├── cli/                           # NEW: only loaded when subcommand invoked
│   ├── setup.ts                   # orchestrates the full setup flow
│   ├── prompts.ts                 # readline wrappers (address, sig, y/n, optional name)
│   ├── signer-page.ts             # generates the static HTML signer
│   └── env-writer.ts              # safe .env writes (no clobber without consent)
├── lib/
│   ├── eip712.ts                  # NEW: signature verification via viem
│   ├── config.ts                  # existing — no changes
│   ├── format.ts                  # existing — no changes
│   └── http.ts                    # existing — no changes
├── services/
│   ├── auth.ts                    # existing + getEip712Message() + mintApiKey()
│   │                              # + 2nd shape for mintJwt({ method: "eip712" })
│   └── pear-client.ts             # existing — no changes
├── tools/                         # existing — no changes
└── types.ts                       # existing + AuthMessageSchema + ApiKeyResponseSchema
```

**Dispatcher in `src/index.ts`:**

```ts
const cmd = process.argv[2];
if (cmd === "setup") {
  const { runSetup } = await import("./cli/setup.js");
  await runSetup();
  process.exit(0);
}
if (cmd === "--help" || cmd === "-h") { printHelp(); process.exit(0); }
if (cmd === "--version" || cmd === "-v") { printVersion(); process.exit(0); }
// default: start FastMCP server (current behavior, unchanged)
await startServer();
```

`runSetup` is loaded via dynamic `import()` so the MCP runtime path doesn't pay the cost of viem / readline / cli/* modules.

**Module boundaries:**

| Module | Depends on | No knowledge of |
|---|---|---|
| `cli/setup.ts` | `cli/prompts`, `cli/signer-page`, `cli/env-writer`, `lib/eip712`, `services/auth`, `lib/config` | FastMCP, tools, runtime server |
| `cli/prompts.ts` | `node:readline/promises` | Network, filesystem |
| `cli/signer-page.ts` | nothing (pure function) | Network, viem |
| `cli/env-writer.ts` | `node:fs/promises` | Network, viem |
| `lib/eip712.ts` | `viem` (`recoverTypedDataAddress` only) | Filesystem, prompts |
| `services/auth.ts` | `lib/http`, `zod` | CLI surface, prompts |

**No new entry in `package.json#bin`** — same `mcp-pear` binary, longer arg list. The bin shebang and dispatcher logic in `src/index.ts` remain the single entry point.

---

## 5. Data flow

```
runSetup()
  │
  ├─ prompts.askAddress()           → "0x…40 hex"  (re-prompt on invalid)
  ├─ prompts.askTokenName()         → optional; default `mcp-pear-<hostname>-<yyyy-mm-dd>`
  │
  ├─ auth.getEip712Message(address)
  │     GET /auth/eip712-message?address=…
  │     ← AuthMessageSchema-validated typedData
  │
  ├─ signer-page.write({ address, typedData, outDir })
  │     • writes <tmpdir>/mcp-pear-sign-<rand>.html
  │     • opens via `open` (mac), `xdg-open` (linux), `start` (win)
  │     • on launch failure: prints path, continues inline
  │
  ├─ prompts.askSignature()         → "0x…130 hex" (re-prompt on invalid)
  │
  ├─ eip712.verify({ typedData, signature, expected: address })
  │     recoverTypedDataAddress() === address?
  │     → on mismatch: print recovered addr, re-prompt for signature
  │
  ├─ auth.mintJwt({ method: "eip712", address, signature, clientId, baseUrl, timeoutMs })
  │     POST /auth/login
  │     ← { accessToken, refreshToken }
  │
  ├─ auth.mintApiKey({ jwt: accessToken, name, baseUrl, timeoutMs })
  │     POST /api-keys (Authorization: Bearer <jwt>)
  │     ← ApiKeyResponseSchema { id, apiKey, name, createdAt }
  │
  ├─ verify: temporarily inject PEAR_API_KEY + PEAR_ADDRESS into process.env,
  │          reset PearClient singleton, call getAccountSummary()
  │     → on 200: "✓ Authenticated (N closed trades)"
  │     → on non-200: print error + still emit the key (see §6)
  │
  ├─ stdout block (always)          → prints PEAR_API_KEY + PEAR_ADDRESS
  │
  └─ env-writer.maybeWrite(cwd, { PEAR_API_KEY, PEAR_ADDRESS })
        • if .env absent: prompt Y/n, write if Y
        • if .env present without these keys: prompt Y/n, append if Y
        • if .env present with one or both keys: prompt explicitly to overwrite
        • on permission denied: instruct user to paste manually, exit 0
```

---

## 6. Error handling

Single, predictable failure mode per stage. No stack traces in user output.

| Stage | Failure | Message | Recovery |
|---|---|---|---|
| Address prompt | not `0x` + 40 hex | `"Address must be 0x followed by 40 hex chars."` | re-prompt |
| `getEip712Message` | network | `"Couldn't reach Pear API at <baseUrl>. Check your connection and try again."` | exit 1, no state |
| `getEip712Message` | 4xx | `"Pear rejected the address: <api message>"` | exit 1 |
| Browser launch | `open`-equivalent missing | falls back to printing path, continues inline | continue |
| Signature prompt | not `0x` + 130 hex | `"Signature must be 0x followed by 130 hex chars (65 bytes)."` | re-prompt |
| `eip712.verify` | recovered ≠ entered | `"Signature was signed by 0xAAA…, expected 0xeb6E…. Did you switch wallets?"` | re-prompt for signature |
| `mintJwt` | 401 | `"Pear rejected the signature. The sign-in message may have expired — re-run setup."` | exit 1 |
| `mintJwt` | non-401 | surfaces `HttpError.body.message` | exit 1 |
| `mintApiKey` | any HTTP error | `"API key minting failed: <message>. JWT is still valid — you can use it directly via PEAR_JWT=<token> mcp-pear"` | exit 0 (partial success — JWT printed) |
| `verify` (account call) | 401 | `"Minted key didn't authenticate — this shouldn't happen. Report this."` | print key anyway, exit 1 |
| `verify` | 200 | `"✓ Authenticated"` | continue |
| `.env` write | exists with target keys | `"./.env already has PEAR_API_KEY. Overwrite? [y/N]"` | skip on N, just stdout |
| `.env` write | permission denied | `"Couldn't write ./.env — paste these into your config:"` then prints vars | exit 0 |

**Two invariants:**

1. **Never partially write state.** API key isn't echoed to stdout until `verify` passes (or explicitly fails via the documented fallback). `.env` isn't touched until the user says yes.
2. **The user can always recover the secret.** Every failure path that *minted* a key still prints it to stdout before exiting. We never mint-and-lose.

**No retries on auth-path API calls** beyond `lib/http.ts`'s existing exponential backoff for 429/5xx. Auth-shaped errors (400, 401, 403) are not transient and shouldn't loop.

---

## 7. Static HTML signer page

A single self-contained HTML file generated per-run with the typed data embedded.

```html
<!doctype html>
<meta charset="utf-8">
<title>mcp-pear — sign in</title>
<style> /* terse layout, mono font, no external CSS */ </style>

<h1>Sign in to Pear Protocol</h1>
<p>Wallet expected: <code id="addr">0xeb6E…1137</code></p>
<p>Once you sign, copy the signature back to the terminal.</p>

<button id="connect">Connect wallet</button>
<button id="sign" disabled>Sign</button>

<textarea id="sig" readonly placeholder="Signature will appear here…"></textarea>
<button id="copy" disabled>Copy signature</button>

<script>
  const address  = "<%= address %>";          // injected, JSON-escaped
  const typedData = <%= typedDataJson %>;     // injected, JSON.stringify-d
  // … window.ethereum.request flow …
</script>
```

**Generation:** `signer-page.write()` is a pure function — takes `{ address, typedData, outDir }`, returns `{ filePath, url }`. JSON values are embedded via `JSON.stringify` (no string interpolation of untrusted data into the script body). The template itself lives as a string constant in `cli/signer-page.ts` — no separate `.html` asset file, no build-step copy.

**Why no local server:**
- No CORS / preflight concerns
- No port-collision handling
- No firewall prompts on macOS
- Trivially testable as a pure function

**Trade-off:** the user must copy/paste the signature back to the terminal. Acceptable friction for a one-time setup, and avoids ~2-3x the implementation surface of a server-based flow.

---

## 8. Testing strategy

**Unit (`tests/`):**

| File | Coverage |
|---|---|
| `tests/cli/prompts.test.ts` | Address regex validation, signature regex validation, default token-name builder, re-prompt loops using a fake stdin stream |
| `tests/cli/signer-page.test.ts` | Generated HTML embeds the `typedData` JSON intact (round-trip parse), address surfaces in the page, no XSS surface (e.g. typedData with `</script>` in it is safely JSON-escaped) |
| `tests/cli/env-writer.test.ts` | Creates `.env` when missing; appends `PEAR_API_KEY` + `PEAR_ADDRESS` when both absent; prompts on existing keys; preserves unrelated vars on append; never writes on `N` |
| `tests/lib/eip712.test.ts` | `verify()` accepts a known-good fixture signature, rejects wrong-address recovery, rejects malformed signature |
| `tests/services/auth.test.ts` (extend) | `mintJwt({ method: "eip712" })` body matches the documented OpenAPI shape; `mintApiKey()` body shape + auth header; response parsing per `ApiKeyResponseSchema` |
| `tests/schemas.test.ts` (extend) | `AuthMessageSchema` parses a representative `/auth/eip712-message` response; `ApiKeyResponseSchema` parses a real `/api-keys` response |

**Live smoke (extend `tests/smoke.test.ts`):**

| Test | Gate | What it does |
|---|---|---|
| `mintApiKey end-to-end` | `PEAR_JWT` set | Calls `mintApiKey(PEAR_JWT, "smoke-test")` against the real API — expects `apiKey` and `id` fields on the response. Doesn't sign. Doesn't revoke — the smoke run produces a real key labelled `smoke-test` that can be revoked manually. |

**Not tested:**

- The browser leg / wallet signing — no value automating this; it's a thin shim over `window.ethereum.request`
- Cross-platform `open` invocation — trivial passthrough
- Full CLI integration end-to-end — covered by manual testing during PR review

**TDD order during implementation:**

1. `lib/eip712.ts` — pure function, easiest to drive
2. `services/auth.ts` additions — extend existing module
3. `cli/env-writer.ts` — filesystem behaviour
4. `cli/signer-page.ts` — HTML generation
5. `cli/prompts.ts` — interactive I/O with mocked stdin
6. `cli/setup.ts` — orchestrator, wire it all up
7. `src/index.ts` dispatcher — smallest piece, last

---

## 9. Dependencies & package surface

**Added runtime dependency:** `viem` (latest stable in the 2.x line). Only the `recoverTypedDataAddress` export is imported, so esbuild/tsc tree-shaking keeps the published tarball impact ~50–100 KB (vs ~80 KB today). Acceptable.

**`viem` is paid forward to v0.2** for trade signing — this is not a single-use dependency.

**No changes to `package.json#bin`, `files`, or `engines`.**

**Version bump:** `0.1.0` → `0.1.1` (patch). Changeset committed describing "Adds `mcp-pear setup` CLI for minting an API key via wallet signature."

---

## 10. Documentation updates

- **README:** new "Getting started" subsection with the `npx … setup` flow. Demotes the "open DevTools" instruction to a fallback/advanced section. The auto-generated tools table is unaffected.
- **`examples/`:** no new examples needed — setup is self-explanatory from the CLI.
- **Changeset:** human-readable line for the changelog.

---

## 11. Out of scope

Explicitly **not** in v0.1.1:

- Listing / revoking existing API keys via the CLI (`mcp-pear keys list/revoke`) — defer to v0.2 or later
- Hardware wallet support (Ledger / Trezor) via CLI signing — Foundry / cast users can sign manually and paste
- Privy access-token flow (`POST /auth/login` with `method: "privy_access_token"`) — same DevTools problem, doesn't move the UX needle
- Automatic Claude Desktop config patching — JSON-with-comments parsing + cross-platform path resolution is too much surface for a v0.1.x patch
- Multi-wallet / multi-account setup — single wallet per run
- Updating the runtime MCP server to mint its own API key on demand — out of scope; setup is a separate one-shot flow

---

## 12. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `/auth/eip712-message` response shape differs from inferred OpenAPI | medium | Implementation step 1 inspects the live response; spec adjusted before any signer logic is written |
| User signs from a different wallet account than they entered | high | `eip712.verify` catches this locally before round-tripping to Pear; user re-signs without restarting |
| User's browser doesn't auto-launch the HTML file | medium | Print the file path; the file is self-contained, so the user can open it manually |
| `viem`'s `recoverTypedDataAddress` differs from Pear's recovery (e.g. EIP-191 vs EIP-712 ambiguity) | low | Smoke-test mint-and-call flow with a known signature before shipping |
| API key minted but `.env` write fails silently | low | `env-writer.maybeWrite` returns a discriminated result; setup prints the key to stdout regardless |
