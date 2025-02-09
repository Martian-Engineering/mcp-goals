import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WorkspaceManager } from "./workspace.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export function createServer(workspaceManager: WorkspaceManager): McpServer {
  const server = new McpServer({
    name: "Goals MCP Server",
    version: "1.0.0",
    capabilities: {
      tools: {},
      resources: {},
    },
  });

  // Define tools with detailed descriptions
  const CREATE_WORKSPACE_TOOL: Tool = {
    name: "create-workspace",
    description: `Creates a new workspace for managing goals.

      A workspace corresponds to a specific directory (usually a git repository)
      where goals and related data will be stored.
      Each workspace must have a unique name and a valid filesystem path.`,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Unique identifier for the workspace. Used in commands and URLs.",
        },
        path: {
          type: "string",
          description:
            "Absolute filesystem path where the workspace contents will be stored.",
        },
      },
      required: ["name", "path"],
    },
  };

  const INIT_WORKSPACE_TOOL: Tool = {
    name: "init-workspace",
    description: `Initializes or activates an existing workspace.

    This updates the workspace's last_active timestamp and ensures it's ready for use. Must be called before performing operations in a workspace.`,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of an existing workspace to initialize",
        },
      },
      required: ["name"],
    },
  };

  // Register tools
  server.tool(
    CREATE_WORKSPACE_TOOL.name,
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
    INIT_WORKSPACE_TOOL.name,
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

  // Define and register resources
  server.resource(
    "workspaces",
    "workspaces://list",
    {
      description: `Lists all available workspaces in descending order of last activity.
      Each workspace entry includes its name, filesystem path, and last active timestamp.`,
      examples: [
        {
          description: "List all workspaces",
          uri: "workspaces://list",
        },
      ],
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: workspaceManager
            .getAll()
            .map((w) => `${w.name}: ${w.path} (${w.last_active})`)
            .join("\n"),
        },
      ],
    }),
  );

  return server;
}
