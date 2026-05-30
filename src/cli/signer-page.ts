export interface SignerPageInput {
	address: string;
	typedData: unknown;
}

/**
 * Returns a self-contained HTML document with the typed data
 * embedded via JSON.stringify (script-tag-safe).
 */
export function generateSignerHtml(input: SignerPageInput): string {
	const typedDataJson = scriptSafeJson(input.typedData);
	const addressEscaped = htmlEscape(input.address);
	const addressJson = JSON.stringify(input.address);
	return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mcp-pear: sign in to Pear Protocol</title>
<style>
  :root {
    --bg: #050505;
    --bg-card: #0c0c0c;
    --border: rgba(255, 255, 255, 0.06);
    --border-strong: rgba(255, 255, 255, 0.1);
    --text: #f5f5f5;
    --muted: #8a8a8a;
    --muted-soft: #5a5a5a;
    --accent: #c1f57a;
    --accent-soft: rgba(193, 245, 122, 0.12);
    --accent-soft-strong: rgba(193, 245, 122, 0.22);
    --danger: #ef5350;
    --danger-soft: rgba(239, 83, 80, 0.1);
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }

  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    background:
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(193, 245, 122, 0.08), transparent 60%),
      var(--bg);
    color: var(--text);
    font-family: var(--sans);
    font-size: 15px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .shell {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
  }

  .stack {
    width: 100%;
    max-width: 480px;
    animation: rise 420ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }

  @keyframes rise {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 28px;
  }

  .leaf {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: var(--accent-soft);
    margin-bottom: 18px;
  }
  .leaf svg { display: block; }

  h1 {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.015em;
    margin: 0 0 8px;
  }
  .lede {
    color: var(--muted);
    margin: 0;
    font-size: 14px;
    max-width: 340px;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 22px;
  }

  .meta {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 10px 14px;
    font-size: 13px;
    padding-bottom: 18px;
    margin-bottom: 18px;
    border-bottom: 1px solid var(--border);
  }
  .meta dt {
    color: var(--muted);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.06em;
    padding-top: 2px;
  }
  .meta dd {
    margin: 0;
    font-size: 13px;
    color: var(--text);
    overflow-wrap: anywhere;
  }
  .meta dd.mono {
    font-family: var(--mono);
    font-size: 12.5px;
  }
  .chain-id {
    color: var(--muted);
    font-family: var(--mono);
    font-size: 11.5px;
    margin-left: 6px;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 13px;
    background: rgba(255, 255, 255, 0.03);
    color: var(--muted);
    border: 1px solid var(--border);
    margin-bottom: 14px;
    min-height: 44px;
  }
  .status .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted-soft);
    flex-shrink: 0;
  }
  .status.ok { background: var(--accent-soft); color: var(--accent); border-color: var(--accent-soft-strong); }
  .status.ok .dot { background: var(--accent); box-shadow: 0 0 0 4px rgba(193, 245, 122, 0.15); }
  .status.err { background: var(--danger-soft); color: var(--danger); border-color: rgba(239, 83, 80, 0.22); }
  .status.err .dot { background: var(--danger); }
  .status.working .dot {
    background: var(--accent);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  .actions {
    display: grid;
    gap: 10px;
  }

  button.primary, button.secondary {
    font: inherit;
    font-weight: 600;
    font-size: 14px;
    padding: 12px 18px;
    border-radius: 10px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 120ms ease, color 120ms ease, transform 120ms ease;
  }
  button.primary {
    background: var(--accent);
    color: #0a0f00;
    border-color: var(--accent);
  }
  button.primary:hover:not(:disabled) {
    background: #d5fa92;
    border-color: #d5fa92;
  }
  button.primary:active:not(:disabled) { transform: translateY(1px); }
  button.secondary {
    background: rgba(193, 245, 122, 0.08);
    color: var(--accent);
    border-color: var(--accent-soft-strong);
  }
  button.secondary:hover:not(:disabled) {
    background: rgba(193, 245, 122, 0.14);
  }
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .sig-section {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--border);
  }
  .sig-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .sig-label {
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  button.ghost {
    font: inherit;
    font-size: 12px;
    font-weight: 500;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    background: transparent;
    color: var(--muted);
    border: 1px solid var(--border-strong);
    transition: color 120ms, border-color 120ms;
  }
  button.ghost:hover:not(:disabled) { color: var(--text); border-color: var(--muted); }
  button.ghost:disabled { opacity: 0.35; cursor: not-allowed; }

  textarea {
    width: 100%;
    height: 72px;
    background: #060606;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 11.5px;
    resize: vertical;
    box-sizing: border-box;
  }
  textarea:focus { outline: none; border-color: var(--muted); }
  textarea::placeholder { color: var(--muted-soft); }

  .foot {
    text-align: center;
    padding: 24px 20px 32px;
    color: var(--muted-soft);
    font-size: 12px;
    line-height: 1.6;
  }
  .foot strong { color: var(--muted); font-weight: 500; }
</style>

<div class="shell">
  <div class="stack">
    <div class="brand">
      <div class="leaf" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c1f57a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3c4 3 6 6 6 10a6 6 0 0 1-12 0c0-4 2-7 6-10z"></path>
          <path d="M12 3v18"></path>
        </svg>
      </div>
      <h1>Sign in to Pear Protocol</h1>
      <p class="lede">Approve the typed message in your wallet to mint your API key. mcp-pear never sees your private key.</p>
    </div>

    <div class="card">
      <dl class="meta">
        <dt>Wallet</dt>
        <dd class="mono">${addressEscaped}</dd>
        <dt>Chain</dt>
        <dd id="chain-hint">checking…</dd>
      </dl>

      <div class="status" id="status" role="status" aria-live="polite">
        <span class="dot"></span>
        <span id="status-text">Ready to connect.</span>
      </div>

      <div class="actions">
        <button class="primary" id="connect" type="button">Connect wallet</button>
        <button class="secondary" id="sign" type="button" disabled>Sign typed data</button>
      </div>

      <div class="sig-section">
        <div class="sig-header">
          <span class="sig-label">Signature</span>
          <button class="ghost" id="copy" type="button" disabled>Copy</button>
        </div>
        <textarea id="sig" readonly placeholder="Appears here after signing"></textarea>
      </div>
    </div>
  </div>
</div>

<div class="foot">
  <strong>mcp-pear</strong> · unofficial sign-in flow. Not affiliated with Pear Protocol.
</div>

<script>
  const expectedAddress = ${addressJson};
  const typedData = ${typedDataJson};

  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");
  const statusText = $("status-text");
  const setStatus = (msg, cls) => {
    statusText.textContent = msg;
    statusEl.className = "status" + (cls ? " " + cls : "");
  };

  const CHAIN_NAMES = {
    1: "Ethereum",
    42161: "Arbitrum One",
    8453: "Base",
    10: "Optimism",
    137: "Polygon",
    998: "Hyperliquid Testnet",
    999: "Hyperliquid",
  };

  (function showChainHint() {
    const id = Number(typedData.domain && typedData.domain.chainId);
    const dd = $("chain-hint");
    if (!id) { dd.textContent = "unknown"; return; }
    const name = CHAIN_NAMES[id] || "Chain " + id;
    const idSpan = document.createElement("span");
    idSpan.className = "chain-id";
    idSpan.textContent = "· " + id;
    dd.textContent = name + " ";
    dd.appendChild(idSpan);
  })();

  let connectedAddress = null;

  $("connect").addEventListener("click", async () => {
    if (!window.ethereum) {
      setStatus("No wallet found. Install MetaMask, Rabby, or Frame.", "err");
      return;
    }
    setStatus("Requesting wallet connection…", "working");
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      connectedAddress = accounts[0];
      if (connectedAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
        setStatus("Connected " + connectedAddress + ", but expected " + expectedAddress + ". Switch accounts in your wallet.", "err");
        return;
      }
      setStatus("Connected: " + connectedAddress, "ok");
      $("sign").disabled = false;
    } catch (err) {
      setStatus("Connect failed: " + (err.message || err), "err");
    }
  });

  function chainIdHex() {
    const id = Number(typedData.domain && typedData.domain.chainId);
    if (!id) return null;
    return "0x" + id.toString(16);
  }

  async function ensureChain(targetHex) {
    const current = await window.ethereum.request({ method: "eth_chainId" });
    if (current.toLowerCase() === targetHex.toLowerCase()) return;
    setStatus("Switching wallet to chain " + targetHex + "…", "working");
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetHex }],
      });
    } catch (e) {
      if (e && e.code === 4902) {
        throw new Error(
          "Chain " + targetHex + " is not added to your wallet. Add it manually (e.g. Arbitrum One for 0xa4b1) and click Sign again.",
        );
      }
      throw e;
    }
  }

  $("sign").addEventListener("click", async () => {
    try {
      const target = chainIdHex();
      if (target) await ensureChain(target);
      setStatus("Awaiting wallet signature…", "working");
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
</html>
`;
}

function scriptSafeJson(value: unknown): string {
	// Replace `<` with `<` so an injected `</script>` in user data
	// can't break out of the embedding script block.
	return JSON.stringify(value).replace(/</g, "\\u003c");
}

function htmlEscape(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
