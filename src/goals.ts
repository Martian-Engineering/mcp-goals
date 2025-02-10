import { join } from "path";
import { mkdir, readFile, writeFile, readdir } from "fs/promises";
import { existsSync, statSync } from "fs";

export interface GoalState {
  active_goal: string | null;
  last_updated: string;
}

export interface Goal {
  name: string;
  created_at: string;
  last_updated: string;
  planPath?: string;
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

  static getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  async createGoal(name: string, planContent: string): Promise<Goal> {
    const goalDir = join(this.goalsDir, "goals", name);
    if (existsSync(goalDir)) {
      throw new Error(`Goal "${name}" already exists`);
    }

    await mkdir(goalDir, { recursive: true });
    await mkdir(join(goalDir, "learnings"), { recursive: true });

    const planPath = join(goalDir, "plan.md");
    await writeFile(planPath, planContent);

    const goal: Goal = {
      name,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      planPath,
    };

    return goal;
  }

  async getPlan(name: string): Promise<string | null> {
    const planPath = join(this.goalsDir, "goals", name, "plan.md");
    if (!existsSync(planPath)) {
      return null;
    }

    try {
      return await readFile(planPath, "utf-8");
    } catch (error) {
      return null;
    }
  }

  async updatePlan(name: string, planContent: string): Promise<void> {
    const planPath = join(this.goalsDir, "goals", name, "plan.md");
    if (!existsSync(planPath)) {
      throw new Error(`Goal "${name}" does not exist`);
    }

    await writeFile(planPath, planContent);
  }

  async getGoalDescription(name: string): Promise<string | null> {
    const plan = await this.getPlan(name);
    if (!plan) return null;

    try {
      const matches = plan.match(/^#\s+(.+?)\n\n(.+?)(?=\n\n|$)/s);
      if (!matches) return null;

      const [, title, description] = matches;
      return `${title}\n\n${description}`;
    } catch (error) {
      return null;
    }
  }

  async listGoals(): Promise<string[]> {
    const goalsDir = join(this.goalsDir, "goals");
    if (!existsSync(goalsDir)) {
      return [];
    }

    const entries = await readdir(goalsDir);
    return entries.filter((entry) => {
      const stat = statSync(join(goalsDir, entry));
      return stat.isDirectory();
    });
  }

  async getGoalSummaries(): Promise<
    Array<{ name: string; description: string | null }>
  > {
    const goals = await this.listGoals();
    const summaries = await Promise.all(
      goals.map(async (name) => ({
        name,
        description: await this.getGoalDescription(name),
      })),
    );
    return summaries;
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
}
