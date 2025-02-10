import { createServer } from "./server";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  CallToolResultSchema,
  ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types";
import { rm, writeFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { WorkspaceManager } from "./workspace";
import { GoalManager } from "./goals";

const TEST_DIR = join(homedir(), ".goals-TEST");

describe("Goals MCP Server", () => {
  beforeEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  it("should support the complete workspace workflow", async () => {
    const workspaceManager = new WorkspaceManager(TEST_DIR);
    await workspaceManager.init();

    const server = createServer(workspaceManager);
    const client = new Client(
      { name: "test-client", version: "1.0" },
      { capabilities: { tools: {}, resources: {} } },
    );

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    const testWorkspacePath = join(TEST_DIR, "test-workspace");

    // 1. Create a workspace
    const createResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "create-workspace",
          arguments: {
            name: "test-workspace",
            path: testWorkspacePath,
          },
        },
      },
      CallToolResultSchema,
    );

    expect(createResult.content[0]).toEqual({
      type: "text",
      text: 'Workspace "test-workspace" created successfully',
    });

    // 2. List workspaces
    const listResult = await client.request(
      {
        method: "resources/read",
        params: {
          uri: "workspaces://list",
        },
      },
      ReadResourceResultSchema,
    );

    expect(listResult.contents[0].text).toContain(
      `test-workspace: ${testWorkspacePath}`,
    );

    // 3. Initialize workspace
    const initResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "init-workspace",
          arguments: {
            name: "test-workspace",
          },
        },
      },
      CallToolResultSchema,
    );

    expect(initResult.content[0].text).toContain(
      'Workspace "test-workspace" initialized',
    );
    expect(initResult.content[0].type).toBe("text");

    await client.close();
    await server.close();
  });

  it("should persist workspaces across server restarts", async () => {
    const workspaceManager1 = new WorkspaceManager(TEST_DIR);
    await workspaceManager1.init();

    // First server instance
    const server1 = createServer(workspaceManager1);
    const client1 = new Client(
      { name: "test-client", version: "1.0" },
      { capabilities: { tools: {}, resources: {} } },
    );

    const [clientTransport1, serverTransport1] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client1.connect(clientTransport1),
      server1.connect(serverTransport1),
    ]);

    // Create workspace
    await client1.request(
      {
        method: "tools/call",
        params: {
          name: "create-workspace",
          arguments: {
            name: "persistent-workspace",
            path: "/persistent/path",
          },
        },
      },
      CallToolResultSchema,
    );

    await client1.close();
    await server1.close();

    // Create new server instance
    const workspaceManager2 = new WorkspaceManager(TEST_DIR);
    await workspaceManager2.init();
    const server2 = createServer(workspaceManager2);
    const client2 = new Client(
      { name: "test-client", version: "1.0" },
      { capabilities: { tools: {}, resources: {} } },
    );

    const [clientTransport2, serverTransport2] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client2.connect(clientTransport2),
      server2.connect(serverTransport2),
    ]);

    // Verify workspace still exists
    const listResult = await client2.request(
      {
        method: "resources/read",
        params: {
          uri: "workspaces://list",
        },
      },
      ReadResourceResultSchema,
    );

    expect(listResult.contents[0].text).toContain(
      "persistent-workspace: /persistent/path",
    );

    await client2.close();
    await server2.close();
  });
});

it("should provide rich workspace initialization info", async () => {
  const workspaceManager = new WorkspaceManager(TEST_DIR);
  await workspaceManager.init();

  const server = createServer(workspaceManager);
  const client = new Client(
    { name: "test-client", version: "1.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  const testWorkspacePath = join(TEST_DIR, "test-workspace");

  // Create and initialize workspace
  await client.request(
    {
      method: "tools/call",
      params: {
        name: "create-workspace",
        arguments: {
          name: "test-workspace",
          path: testWorkspacePath,
        },
      },
    },
    CallToolResultSchema,
  );

  await client.request(
    {
      method: "tools/call",
      params: {
        name: "init-workspace",
        arguments: {
          name: "test-workspace",
        },
      },
    },
    CallToolResultSchema,
  );

  // Create a test goal
  await client.request(
    {
      method: "tools/call",
      params: {
        name: "create-goal",
        arguments: {
          name: "test-goal",
          plan: "# Test Goal\n\nThis is a test goal description.\n\n## Details\nMore details.",
        },
      },
    },
    CallToolResultSchema,
  );

  // Set it as active
  await client.request(
    {
      method: "tools/call",
      params: {
        name: "set-active-goal",
        arguments: {
          name: "test-goal",
        },
      },
    },
    CallToolResultSchema,
  );

  // Initialize workspace again to see the goal info
  const initResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "init-workspace",
        arguments: {
          name: "test-workspace",
        },
      },
    },
    CallToolResultSchema,
  );

  expect(initResult.content[0].text).toContain("test-workspace");
  expect(initResult.content[0].text).toContain(
    '<active_goal name="test-goal">',
  );
  expect(initResult.content[0].text).toContain("Test Goal");
  expect(initResult.content[0].text).toContain(
    "This is a test goal description",
  );

  console.log(initResult.content[0].text);

  await client.close();
  await server.close();
});

it("should handle workspace initialization with no goals", async () => {
  const workspaceManager = new WorkspaceManager(TEST_DIR);
  await workspaceManager.init();

  const server = createServer(workspaceManager);
  const client = new Client(
    { name: "test-client", version: "1.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  // Create a workspace
  await client.request(
    {
      method: "tools/call",
      params: {
        name: "create-workspace",
        arguments: {
          name: "empty-workspace",
          path: join(TEST_DIR, "empty-workspace"),
        },
      },
    },
    CallToolResultSchema,
  );

  // Initialize workspace
  const initResult = await client.request(
    {
      method: "tools/call",
      params: {
        name: "init-workspace",
        arguments: {
          name: "empty-workspace",
        },
      },
    },
    CallToolResultSchema,
  );

  expect(initResult.content[0].text).toContain("empty-workspace");
  expect(initResult.content[0].text).toContain("no active goal");
  expect(initResult.content[0].text).not.toContain("Available goals");

  await client.close();
  await server.close();
});
