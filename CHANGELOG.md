# @marvelcodes/mcp-pear

## 0.1.2

### Patch Changes

- Fix `mcp-pear setup`: serve the signer page over `http://127.0.0.1:<port>` instead of `file://`. Browser wallet extensions (MetaMask, Rabby, Frame) don't inject `window.ethereum` into `file://` pages by default, which made every fresh setup flow show "No wallet found". The new local-server flow uses an ephemeral port and shuts down cleanly after the signature is pasted.

## 0.1.1

### Patch Changes

- 92975e5: Add `mcp-pear setup` subcommand: interactive CLI that mints a Pear Protocol API key via wallet signature (EIP-712), with a bundled static HTML signer page (no local server). Closes the v0.1 onboarding gap where users had to extract a JWT from browser DevTools to use authenticated tools.
