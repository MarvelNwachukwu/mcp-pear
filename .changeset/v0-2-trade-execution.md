---
"@marvelcodes/mcp-pear": minor
---

Add 10 trade-execution MCP tools (position open / close / close-all / adjust / adjust-leverage / set-risk-parameters, order cancel / cancel-twap, agent wallet get / create) behind a hard `PEAR_TRADE_ENABLED=true` env gate. Pear signs server-side, so mcp-pear never handles private keys for trades. Read tools (v0.1) are unaffected.
