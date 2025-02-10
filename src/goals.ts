import { join } from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

export interface GoalState {
  active_goal: string | null;
  last_updated: string;
}

export interface Goal {
  name: string;
  created_at: string;
  last_updated: string;
}

export interface Learning {
  timestamp: string; // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
  title: string;
  context: string;
  details: string;
  rationale: string;
  alternatives: string;
  references: string;
}

export class GoalManager {
  private readonly goalsDir: string;
  private readonly statePath: string;
  private state: GoalState = {
    active_goal: null,
    last_updated: new Date().toISOString(),
  };

  constructor(workspacePath: string) {
    this.goalsDir = join(workspacePath, ".goals");
    this.statePath = join(this.goalsDir, "state.json");
  }

  async init(): Promise<void> {
    await this.ensureDirectoryStructure();
    await this.loadState();
  }

  private async ensureDirectoryStructure(): Promise<void> {
    if (!existsSync(this.goalsDir)) {
      await mkdir(this.goalsDir, { recursive: true });
      await mkdir(join(this.goalsDir, "goals"), { recursive: true });
      await mkdir(join(this.goalsDir, "learnings"), { recursive: true });
    }
  }

  private async loadState(): Promise<void> {
    try {
      const data = await readFile(this.statePath, "utf-8");
      this.state = JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        await this.saveState();
      } else {
        throw error;
      }
    }
  }

  private async saveState(): Promise<void> {
    await writeFile(this.statePath, JSON.stringify(this.state, null, 2));
  }

  private formatLearningContent(learning: Learning): string {
    return `## ${learning.title}

    ### Context
    ${learning.context}

    ### Details
    ${learning.details}

    ### Rationale
    ${learning.rationale}

    ### Alternatives Considered
    ${learning.alternatives}

    ### References
    ${learning.references}
    `;
  }

  async createGoal(name: string): Promise<Goal> {
    const goalDir = join(this.goalsDir, "goals", name);
    if (existsSync(goalDir)) {
      throw new Error(`Goal "${name}" already exists`);
    }

    await mkdir(goalDir, { recursive: true });
    await mkdir(join(goalDir, "learnings"), { recursive: true });
    await writeFile(join(goalDir, "plan.md"), "");

    const goal: Goal = {
      name,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };

    return goal;
  }

  async setActiveGoal(name: string): Promise<void> {
    const goalDir = join(this.goalsDir, "goals", name);
    if (!existsSync(goalDir)) {
      throw new Error(`Goal "${name}" does not exist`);
    }

    this.state.active_goal = name;
    this.state.last_updated = new Date().toISOString();
    await this.saveState();
  }

  getActiveGoal(): string | null {
    return this.state.active_goal;
  }

  private formatTimestampForFilename(timestamp: string): string {
    // Replace colons and periods with underscores to make it filesystem-friendly
    return timestamp.replace(/[:\.]/g, "_");
  }

  private parseTimestampFromFilename(filename: string): string {
    // Convert filesystem-friendly format back to ISO timestamp
    return filename.replace(".md", "").replace(/_/g, (match, index) => {
      if (index === 13 || index === 16) return ":";
      if (index === 19) return ".";
      return match;
    });
  }

  async addLearning(learning: Learning, goalName?: string): Promise<void> {
    const learningDir = goalName
      ? join(this.goalsDir, "goals", goalName, "learnings")
      : join(this.goalsDir, "learnings");

    if (goalName && !existsSync(join(this.goalsDir, "goals", goalName))) {
      throw new Error(`Goal "${goalName}" does not exist`);
    }

    if (!existsSync(learningDir)) {
      await mkdir(learningDir, { recursive: true });
    }

    const filename = `${this.formatTimestampForFilename(learning.timestamp)}.md`;
    const filepath = join(learningDir, filename);

    if (existsSync(filepath)) {
      throw new Error(
        `Learning for timestamp ${learning.timestamp} already exists`,
      );
    }

    await writeFile(filepath, this.formatLearningContent(learning));
  }

  async getLearnings(
    goalName?: string,
  ): Promise<{ timestamp: string; content: string }[]> {
    const learningDir = goalName
      ? join(this.goalsDir, "goals", goalName, "learnings")
      : join(this.goalsDir, "learnings");

    if (!existsSync(learningDir)) {
      return [];
    }

    const files = await readFile(learningDir);
    const learnings = await Promise.all(
      files
        .filter((file) => file.endsWith(".md"))
        .map(async (file) => ({
          timestamp: this.parseTimestampFromFilename(file),
          content: await readFile(join(learningDir, file), "utf-8"),
        })),
    );

    return learnings.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async getLearning(timestamp: string, goalName?: string): Promise<string> {
    const learningDir = goalName
      ? join(this.goalsDir, "goals", goalName, "learnings")
      : join(this.goalsDir, "learnings");

    const filename = `${this.formatTimestampForFilename(timestamp)}.md`;
    const filepath = join(learningDir, filename);

    if (!existsSync(filepath)) {
      throw new Error(`Learning for timestamp ${timestamp} does not exist`);
    }

    return readFile(filepath, "utf-8");
  }

  static getCurrentTimestamp(): string {
    return new Date().toISOString();
  }
}
