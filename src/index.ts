#!/usr/bin/env node
import { FastMCP } from "fastmcp";
import { APP_NAME, APP_VERSION } from "./constants.js";
import * as tools from "./tools/index.js";

const server = new FastMCP({
	name: APP_NAME,
	version: APP_VERSION as `${number}.${number}.${number}`,
});

server.addTool(tools.getHealthTool);
server.addTool(tools.listMarketsTool);
server.addTool(tools.getActiveMarketsTool);
server.addTool(tools.getPairRatioTool);
server.addTool(tools.getAccountSummaryTool);
server.addTool(tools.getOpenPositionsTool);

await server.start({ transportType: "stdio" });
