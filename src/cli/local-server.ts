import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";

export interface ServeHtmlResult {
	url: string;
	close: () => Promise<void>;
}

/**
 * Spin up a single-route HTTP server on an ephemeral port that serves
 * the given HTML at `/`. Returns the URL and a close() handle.
 *
 * Why we don't just open a file:// URL: browser wallet extensions
 * (Rabby, MetaMask, Frame) only inject `window.ethereum` into http(s)
 * pages by default; file:// pages are blocked unless the user
 * explicitly enables "Allow access to file URLs" in the extension's
 * details page. Serving over http://127.0.0.1 sidesteps the issue.
 */
export function serveHtml(html: string): Promise<ServeHtmlResult> {
	return new Promise((resolve, reject) => {
		const server = createServer((req, res) => {
			if (req.method !== "GET") {
				res.writeHead(405, { allow: "GET" });
				res.end("Method Not Allowed");
				return;
			}
			res.writeHead(200, {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
			});
			res.end(html);
		});
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address() as AddressInfo;
			const url = `http://127.0.0.1:${addr.port}/`;
			resolve({ url, close: () => closeServer(server) });
		});
	});
}

function closeServer(server: Server): Promise<void> {
	return new Promise((resolve) => {
		server.close(() => resolve());
		// Force-end any keep-alive sockets so close() resolves promptly.
		server.closeAllConnections?.();
	});
}
