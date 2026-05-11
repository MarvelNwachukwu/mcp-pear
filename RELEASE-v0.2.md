# v0.2.0 — ready for review

**Status:** prepared on `main` but NOT pushed and NOT published.

I (the autonomous agent) finished the full v0.2 implementation, ran every test, and bumped the version. I stopped short of `git push` and `npm publish` because v0.2 introduces write tools that execute real trades against Pear / Hyperliquid — irreversible if anything is wrong. You should review the diff and decide.

## What's in this release

10 new MCP tools (1 read, 9 write) wrapping Pear's trade-execution endpoints:

| Tool | Type | Endpoint |
|---|---|---|
| `get_agent_wallet`     | read  | `GET /agentWallet` |
| `create_agent_wallet`  | write | `POST /agentWallet` |
| `open_position`        | write | `POST /positions` |
| `close_position`       | write | `POST /positions/{id}/close` |
| `close_all_positions`  | write | `POST /positions/close-all` |
| `adjust_position`      | write | `POST /positions/{id}/adjust` |
| `adjust_leverage`      | write | `POST /positions/{id}/adjust-leverage` |
| `set_risk_parameters`  | write | `PUT /positions/{id}/riskParameters` |
| `cancel_order`         | write | `DELETE /orders/{id}/cancel` |
| `cancel_twap_order`    | write | `POST /orders/{id}/twap/cancel` |

All write tools short-circuit with `ConfigError` unless `PEAR_TRADE_ENABLED=true` is set (strict equality on the literal string `"true"`).

## Verification done

- 130 / 130 unit tests pass (`pnpm test`)
- biome lint clean (`pnpm run lint`)
- tsc build clean (`pnpm run build`)
- 20 MCP tools enumerated via stdio `tools/list` (10 v0.1 + 10 v0.2)
- Server boots cleanly with and without the gate; unlock notice prints to stderr when `PEAR_TRADE_ENABLED=true`
- No live trade smoke ran — see manual checklist below before pushing

## Manual smoke checklist for the operator

Before `git push`:

1. **Read the diff:** `git log v0.1.1..HEAD --stat` — review the 12 v0.2 commits.
2. **Confirm the gate works for real:**
   ```bash
   pnpm run build
   PEAR_JWT='<real>' node dist/index.js   # default — writes blocked
   ```
   Spawn it from Claude Desktop or via stdio and try to call `open_position` — confirm the gate error returns.
3. **Test agent wallet creation on a real account** (cheap, no funds moved):
   ```bash
   PEAR_JWT='<real>' PEAR_TRADE_ENABLED=true node dist/index.js
   ```
   Call `get_agent_wallet` and `create_agent_wallet` from Claude Desktop. Confirm the response includes the Hyperliquid approval instructions.
4. **(Optional but recommended) Place a tiny position and immediately close it.** Pear's minimum is $1 usdValue, so risk is bounded. Use `open_position` with `executionType: "MARKET"`, `leverage: 1`, `usdValue: 1`, then `close_position` immediately.

## To ship

```bash
git push origin main
git push origin v0.2.0
```

CI's release workflow will pick up the version bump and run `pnpm publish-packages` against npm using the `NPM_TOKEN` secret. Once it lands, delete this `RELEASE-v0.2.md` file in a follow-up commit.

## To roll back if something is wrong

```bash
git tag -d v0.2.0                          # delete the local tag
git reset --hard v0.1.1                    # back to last shipped
```

Nothing has been pushed, so there's nothing to clean up upstream. The v0.1.1 release on npm is unaffected by anything on `main` past it.
