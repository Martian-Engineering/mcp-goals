import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { WorkspaceManager } from "./workspace.js";

async function main() {
  const workspaceManager = new WorkspaceManager();
  workspaceManager.init();

  const server = createServer(workspaceManager);
  const transport = new StdioServerTransport();

  console.error("Starting Goals MCP Server...");

  try {
    await server.connect(transport);
    console.error("Server connected successfully");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
