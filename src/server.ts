import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WorkspaceManager } from "./workspace.js";
import { GoalManager } from "./goals.js";
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

      Returns information about the workspace including:
        - Current active goal and its description
        - List of other available goals
        - Instructions for confirming or changing the active goal`,
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

  const CREATE_GOAL_TOOL: Tool = {
    name: "create-goal",
    description: `Creates a new goal in the current workspace.

      The plan content should be a markdown document that describes the goal and its implementation plan.
      The first heading (# Title) and the following paragraph will be used as the goal's summary when listing goals.

      Example plan format:
      # Goal Title

      Brief description of the goal

      ## Background
      ...

      ## Implementation Plan
      ...
      `,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the goal (will be used in commands and URLs)",
        },
        plan: {
          type: "string",
          description: "Full markdown content of the goal's plan",
        },
      },
      required: ["name", "plan"],
    },
  };

  const SET_ACTIVE_GOAL_TOOL: Tool = {
    name: "set-active-goal",
    description:
      "Sets which goal is currently being worked on in the workspace",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the goal to set as active",
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
      const goalManager = new GoalManager(workspace.path);
      await goalManager.init();

      const activeGoal = goalManager.getActiveGoal();
      const goals = await goalManager.getGoalSummaries();

      let response = `Workspace "${workspace.name}" initialized at ${workspace.path}\n\n`;

      if (activeGoal) {
        const activeGoalDescription =
          await goalManager.getGoalDescription(activeGoal);
        if (activeGoalDescription) {
          response += `
          <active_goal name="${activeGoal}">
          ${activeGoalDescription}
          </active_goal>`;
        }
      }

      if (goals.length > 0) {
        response += "\n<all_goals>\n";
        goals.forEach(({ name, description }) => {
          response += `\n- ${name}${description ? `: ${description.split("\n")[0]}` : ""}`;
        });
        response += "\n</all_goals>\n";
      }

      response +=
        "\n\nPlease confirm if you want to continue with " +
        (activeGoal ? `"${activeGoal}"` : "no active goal") +
        " or select a different goal using the set-active-goal tool.";

      return {
        content: [
          {
            type: "text",
            text: response,
          },
        ],
      };
    },
  );

  server.tool(
    CREATE_GOAL_TOOL.name,
    {
      name: z.string(),
      plan: z.string(),
    },
    async ({ name, plan }) => {
      const workspace = workspaceManager.getActiveWorkspace();
      if (!workspace) {
        throw new Error(
          "No workspace is currently active. Call init-workspace first.",
        );
      }

      const goalManager = new GoalManager(workspace.path);
      await goalManager.init();
      await goalManager.createGoal(name, plan);

      return {
        content: [
          {
            type: "text",
            text: `Goal "${name}" created successfully`,
          },
        ],
      };
    },
  );

  server.tool(
    SET_ACTIVE_GOAL_TOOL.name,
    {
      name: z.string(),
    },
    async ({ name }) => {
      const workspace = workspaceManager.getActiveWorkspace();
      if (!workspace) {
        throw new Error(
          "No workspace is currently active. Call init-workspace first.",
        );
      }

      const goalManager = new GoalManager(workspace.path);
      await goalManager.init();
      await goalManager.setActiveGoal(name);

      const description = await goalManager.getGoalDescription(name);

      return {
        content: [
          {
            type: "text",
            text: `Now working on goal: ${name}\n\n${description || ""}`,
          },
        ],
      };
    },
  );

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
