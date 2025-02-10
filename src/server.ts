import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WorkspaceManager } from "./workspace.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

const LEARNINGS_INSTRUCTIONS = `
  Throughout implementation, maintain a record of learnings. You can create a new learning by calling your create_learning tool from mcp-goals. You should create a new learning whenever you encounter:

  * Design decisions made and their rationale
  * Steps attempted (both successful and failed) and their outcomes
  * Architectural decisions and their justification
  * Useful conventions or configuration details discovered
  * Any pitfalls encountered and how they were addressed or worked around
  * Links to relevant documentation or references used

  The content of each entry should be:

  ## [BRIEF TITLE]

  ### Context
  [What led to this learning/decision]

  ### Details
  [The main content of the learning/decision]

  ### Rationale
  [Why this approach was chosen]

  ### Alternatives Considered
  [What other approaches were considered and why they weren't chosen]

  ### References
  [Any relevant documentation links or references]
  `;

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
    description: `Initializes or activates an existing workspace. You should always call this at the start of a session.

    Returns:
      - path: Absolute filesystem path where the workspace contents will be stored.
      - goals: List of goals with brief descriptions in this workspace.
      - recent-goal: The goal that was most recently being worked on.
      - learnings: List of learnings from previous sessions.
    `,
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
            text: `Workspace "${workspace.name}" initialized at ${workspace.path}

            `,
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
