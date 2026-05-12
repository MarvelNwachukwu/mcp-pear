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
<p>Target chain: <code id="chain-hint">checking…</code></p>
<p class="muted">Connect your wallet, sign the typed data, then copy the signature back to your terminal. If your wallet is on a different chain, Sign will prompt you to switch first.</p>

<div class="status" id="status">Ready.</div>

<button id="connect">Connect wallet</button>
<button id="sign" disabled>Sign typed data</button>

<p><label>Signature: <button id="copy" disabled>Copy</button></label></p>
<textarea id="sig" readonly placeholder="Signature will appear here after signing…"></textarea>

<script>
  const expectedAddress = ${addressJson};
  const typedData = ${typedDataJson};

  const $ = (id) => document.getElementById(id);
  const setStatus = (msg, cls) => {
    const el = $("status");
    el.textContent = msg;
    el.className = "status" + (cls ? " " + cls : "");
  };

  (function showChainHint() {
    const id = Number(typedData.domain && typedData.domain.chainId);
    if (!id) { $("chain-hint").textContent = "unknown"; return; }
    const hex = "0x" + id.toString(16);
    $("chain-hint").textContent = id + " (" + hex + ")";
  })();

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
    setStatus("Switching wallet to chain " + targetHex + "…", "ok");
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
