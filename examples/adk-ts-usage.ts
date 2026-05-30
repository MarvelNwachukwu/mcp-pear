// Example: integrating mcp-pear into an ADK-TS agent.
// npm install @iqai/adk @modelcontextprotocol/sdk
import { McpToolset, StdioTransport } from "@iqai/adk";

const pearTools = new McpToolset({
	transport: new StdioTransport({
		command: "npx",
		args: ["-y", "@marvelcodes/mcp-pear@latest"],
		env: {
			PEAR_API_KEY: process.env.PEAR_API_KEY ?? "",
			PEAR_ADDRESS: process.env.PEAR_ADDRESS ?? "",
		},
	}),
});

await pearTools.connect();
const tools = await pearTools.listTools();
console.log("Available Pear tools:", tools.map((t) => t.name).join(", "));

// Pass `tools` into your ADK agent's tool list as you would any other toolset.
