import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Creates and configures an MCP server instance
 * @returns Configured MCP server instance
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "Goals MCP Server",
    version: "1.0.0",
  });

  // Add a goal resource that allows storing and retrieving goals
  const goals = new Map<string, string>();
  
  server.tool(
    "add-goal",
    {
      id: z.string(),
      description: z.string(),
    },
    async ({ id, description }) => {
      goals.set(id, description);
      return {
        content: [
          {
            type: "text",
            text: `Goal "${id}" added successfully`,
          },
        ],
      };
    }
  );

  // Add a resource to list all goals
  server.resource(
    "goals",
    "goals://list",
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: Array.from(goals.entries())
            .map(([id, desc]) => `${id}: ${desc}`)
            .join("\n"),
        },
      ],
    })
  );

  // Add a resource to get a specific goal
  server.resource(
    "goal",
    new ResourceTemplate("goals://{id}", { list: undefined }),
    async (uri, variables) => {
      const id = variables.id as string;
      const goal = goals.get(id);
      if (!goal) {
        throw new Error(`Goal "${id}" not found`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            text: goal,
          },
        ],
      };
    }
  );

  return server;
}
