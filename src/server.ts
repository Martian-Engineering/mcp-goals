import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WorkspaceManager } from "./workspace.js";

export function createServer(workspaceManager: WorkspaceManager): McpServer {
  const server = new McpServer({
    name: "Goals MCP Server",
    version: "1.0.0",
    capabilities: {
      tools: {},
      resources: {},
    },
  });

  server.tool(
    "create-workspace",
    {
      name: z.string(),
      path: z.string(),
    },
    async ({ name, path }) => {
      const workspace = await workspaceManager.createWorkspace(name, path);
      return {
        content: [
          {
            type: "text",
            text: `Workspace "${workspace.name}" created successfully`,
          },
        ],
      };
    },
  );

  server.tool(
    "init-workspace",
    {
      name: z.string(),
    },
    async ({ name }) => {
      const workspace = await workspaceManager.updateLastActive(name);
      return {
        content: [
          {
            type: "text",
            text: `Workspace "${workspace.name}" initialized`,
          },
        ],
      };
    },
  );

  server.resource("workspaces", "workspaces://list", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: workspaceManager
          .getAll()
          .map((w) => `${w.name}: ${w.path} (${w.last_active})`)
          .join("\n"),
      },
    ],
  }));

  return server;
}
