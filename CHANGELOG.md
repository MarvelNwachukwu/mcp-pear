# @marvelcodes/mcp-pear

## 0.2.0

### Minor Changes

- Add 10 trade-execution MCP tools (position open / close / close-all / adjust / adjust-leverage / set-risk-parameters, order cancel / cancel-twap, agent wallet get / create) behind a hard `PEAR_TRADE_ENABLED=true` env gate. Pear signs server-side, so mcp-pear never handles private keys for trades. Read tools (v0.1) are unaffected.

## 0.1.4

### Patch Changes

- - Rewrite the README for clarity: tighter prose, no em dashes or emojis, public/auth tool grouping, and a "What's next" section announcing v0.2 trade execution (ten new write tools gated behind `PEAR_TRADE_ENABLED=true`, agent wallet signs server-side).
  - Restyle the `mcp-pear setup` signer page with Pear Protocol's dark/lime aesthetic: card layout, lime accent, status pill with animated dot, primary/secondary buttons. Chain row now shows human-readable names (Arbitrum One, Hyperliquid, Base, etc.) instead of raw hex.
  - Strip em dashes from CLI step labels, error messages, and code comments so the setup output reads cleaner.

## 0.1.3

### Patch Changes

- Fix four `mcp-pear setup` bugs surfaced during live testing:

  - Auto-switch wallet to the typed-data `chainId` (42161 / Arbitrum One) before signing, instead of failing with `chainId should be same as current chainId`. Surfaces the target chain on the signer page.
  - Pass `clientId` to `GET /auth/eip712-message` so the returned message has `message.clientId` populated; without it wallets rejected the sign with `missing value for field clientId of type string`.
  - Inject the canonical `EIP712Domain` entry into `types` before signing/recovering. Pear's response omits it; viem and the wallet auto-derive different field orders, so the recovered signer didn't match the actual one.
  - Include `timestamp` in the `POST /auth/login` eip712 details. Pear requires both `signature` and `timestamp`; we were only sending `signature` and getting 401.

  End-to-end setup now works: typed-data fetch → wallet sign → JWT mint → API key mint → `/accounts` verification → `.env` write.

## 0.1.2

### Patch Changes

- Fix `mcp-pear setup`: serve the signer page over `http://127.0.0.1:<port>` instead of `file://`. Browser wallet extensions (MetaMask, Rabby, Frame) don't inject `window.ethereum` into `file://` pages by default, which made every fresh setup flow show "No wallet found". The new local-server flow uses an ephemeral port and shuts down cleanly after the signature is pasted.

## 0.1.1

### Patch Changes

- 92975e5: Add `mcp-pear setup` subcommand: interactive CLI that mints a Pear Protocol API key via wallet signature (EIP-712), with a bundled static HTML signer page (no local server). Closes the v0.1 onboarding gap where users had to extract a JWT from browser DevTools to use authenticated tools.
