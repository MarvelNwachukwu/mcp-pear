#!/usr/bin/env node
import { FastMCP } from "fastmcp";
import { APP_NAME, APP_VERSION } from "./constants.js";

const server = new FastMCP({
	name: APP_NAME,
	version: APP_VERSION as `${number}.${number}.${number}`,
});

// Tools registered here in Task 12+.

await server.start({ transportType: "stdio" });
