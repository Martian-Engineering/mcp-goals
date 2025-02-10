import { join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { rm } from "fs/promises";
import { homedir } from "os";
import { GoalManager } from "./goals";

describe("GoalManager", () => {
  const TEST_DIR = join(homedir(), ".goals-test-manager");
  const WORKSPACE_PATH = join(TEST_DIR, "test-workspace");

  beforeEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    await mkdir(WORKSPACE_PATH, { recursive: true });
  });

  it("should initialize with empty state", async () => {
    const manager = new GoalManager(WORKSPACE_PATH);
    await manager.init();

    expect(manager.getActiveGoal()).toBeNull();
    expect(await manager.listGoals()).toEqual([]);
  });

  it("should create and read goals", async () => {
    const manager = new GoalManager(WORKSPACE_PATH);
    await manager.init();

    const goalName = "test-goal";
    await manager.createGoal(goalName, "");

    // Write a test plan
    const planContent = `# Test Goal

This is a test goal description.

## Details
More details here.`;

    await writeFile(
      join(WORKSPACE_PATH, ".goals", "goals", goalName, "plan.md"),
      planContent,
    );

    const description = await manager.getGoalDescription(goalName);
    expect(description).toBe("Test Goal\n\nThis is a test goal description.");

    const goals = await manager.listGoals();
    expect(goals).toContain(goalName);
  });

  it("should manage active goal state", async () => {
    const manager = new GoalManager(WORKSPACE_PATH);
    await manager.init();

    const goalName = "test-goal";
    await manager.createGoal(goalName, "");
    await manager.setActiveGoal(goalName);

    expect(manager.getActiveGoal()).toBe(goalName);
  });

  it("should get summaries of all goals", async () => {
    const manager = new GoalManager(WORKSPACE_PATH);
    await manager.init();

    // Create two goals with different content
    await manager.createGoal("goal1", "");
    await manager.createGoal("goal2", "");

    await writeFile(
      join(WORKSPACE_PATH, ".goals", "goals", "goal1", "plan.md"),
      "# Goal One\n\nFirst goal description.\n\n## Details\nMore details.",
    );

    await writeFile(
      join(WORKSPACE_PATH, ".goals", "goals", "goal2", "plan.md"),
      "# Goal Two\n\nSecond goal description.\n\n## Details\nMore details.",
    );

    const summaries = await manager.getGoalSummaries();
    expect(summaries).toHaveLength(2);
    expect(summaries).toContainEqual({
      name: "goal1",
      description: "Goal One\n\nFirst goal description.",
    });
    expect(summaries).toContainEqual({
      name: "goal2",
      description: "Goal Two\n\nSecond goal description.",
    });
  });
});
