import { createServer } from "./server";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  CallToolResultSchema,
  ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types";
import { rm } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { WorkspaceManager } from "./workspace";

describe("Goals MCP Server", () => {
  const TEST_DIR = join(homedir(), ".goals-TEST");

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

    // 1. Create a workspace
    const createResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "create-workspace",
          arguments: {
            name: "test-workspace",
            path: "/test/path",
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

    expect(listResult.contents[0].text).toContain("test-workspace: /test/path");

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

    expect(initResult.content[0]).toEqual({
      type: "text",
      text: 'Workspace "test-workspace" initialized',
    });

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
