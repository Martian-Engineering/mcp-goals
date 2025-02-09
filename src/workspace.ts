import { homedir } from "os";
import { join } from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

export interface Workspace {
  name: string;
  path: string;
  last_active: string;
}

export interface WorkspaceStore {
  workspaces: Workspace[];
}

export class WorkspaceManager {
  private static readonly DEFAULT_DIR = join(homedir(), ".goals");
  private readonly storeDir: string;
  private workspaces: Workspace[] = [];

  constructor(storeDir?: string) {
    this.storeDir = storeDir ?? WorkspaceManager.DEFAULT_DIR;
  }

  private get workspacesFile(): string {
    return join(this.storeDir, "workspaces.json");
  }

  async init(): Promise<void> {
    await this.ensureDirectoryExists();
    await this.loadWorkspaces();
  }

  private async ensureDirectoryExists(): Promise<void> {
    if (!existsSync(this.storeDir)) {
      await mkdir(this.storeDir, { recursive: true });
    }
  }

  private async loadWorkspaces(): Promise<void> {
    try {
      const data = await readFile(this.workspacesFile, "utf-8");
      const store: WorkspaceStore = JSON.parse(data);
      this.workspaces = store.workspaces;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.workspaces = [];
        await this.saveWorkspaces();
      } else {
        throw error;
      }
    }
  }

  private async saveWorkspaces(): Promise<void> {
    const store: WorkspaceStore = { workspaces: this.workspaces };
    await writeFile(this.workspacesFile, JSON.stringify(store, null, 2));
  }

  getAll(): Workspace[] {
    return [...this.workspaces].sort(
      (a, b) =>
        new Date(b.last_active).getTime() - new Date(a.last_active).getTime(),
    );
  }

  async createWorkspace(name: string, path: string): Promise<Workspace> {
    if (this.workspaces.some((w) => w.name === name)) {
      throw new Error(`Workspace "${name}" already exists`);
    }

    const workspace: Workspace = {
      name,
      path,
      last_active: new Date().toISOString(),
    };

    this.workspaces.push(workspace);
    await this.saveWorkspaces();
    return workspace;
  }

  async updateLastActive(name: string): Promise<Workspace> {
    const workspace = this.workspaces.find((w) => w.name === name);
    if (!workspace) {
      throw new Error(`Workspace "${name}" not found`);
    }

    workspace.last_active = new Date().toISOString();
    await this.saveWorkspaces();
    return workspace;
  }
}
