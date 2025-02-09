import { createServer } from "./server";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  CallToolResultSchema,
  ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types";

describe("Goals MCP Server", () => {
  it("should support the complete goals workflow", async () => {
    // Create server and client
    const server = createServer();
    const client = new Client(
      { name: "test-client", version: "1.0" },
      { capabilities: { tools: {}, resources: {} } },
    );

    // Create and link the transports
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    // Connect both ends
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    // 1. Add a goal
    const addResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "add-goal",
          arguments: {
            id: "goal1",
            description: "My first goal",
          },
        },
      },
      CallToolResultSchema,
    );

    expect(addResult.content[0]).toEqual({
      type: "text",
      text: 'Goal "goal1" added successfully',
    });

    // 2. List all goals
    const listResult = await client.request(
      {
        method: "resources/read",
        params: {
          uri: "goals://list",
        },
      },
      ReadResourceResultSchema,
    );

    expect(listResult.contents[0].text).toContain("goal1: My first goal");

    // 3. Get specific goal
    const getResult = await client.request(
      {
        method: "resources/read",
        params: {
          uri: "goals://goal1",
        },
      },
      ReadResourceResultSchema,
    );

    expect(getResult.contents[0].text).toBe("My first goal");

    // Clean up
    await client.close();
    await server.close();
  });

  it("should handle non-existent goals", async () => {
    const server = createServer();
    const client = new Client(
      { name: "test-client", version: "1.0" },
      { capabilities: { resources: {} } },
    );

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    // Try to get a non-existent goal
    await expect(
      client.request(
        {
          method: "resources/read",
          params: {
            uri: "goals://nonexistent",
          },
        },
        ReadResourceResultSchema,
      ),
    ).rejects.toThrow('Goal "nonexistent" not found');

    await client.close();
    await server.close();
  });

  it("should persist goals across server restarts", async () => {
    // First server instance
    const server1 = createServer();
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

    // Add a goal
    await client1.request(
      {
        method: "tools/call",
        params: {
          name: "add-goal",
          arguments: {
            id: "persistent-goal",
            description: "This goal should persist",
          },
        },
      },
      CallToolResultSchema,
    );

    // Clean up first server
    await client1.close();
    await server1.close();

    // Create new server instance
    const server2 = createServer();
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

    // Verify goal still exists
    const getResult = await client2.request(
      {
        method: "resources/read",
        params: {
          uri: "goals://persistent-goal",
        },
      },
      ReadResourceResultSchema,
    );

    expect(getResult.contents[0].text).toBe("This goal should persist");

    await client2.close();
    await server2.close();
  });
});
