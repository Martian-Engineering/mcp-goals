# MCP Goals

Our goal is to build an MCP server that allows a client to make progress towards goals, recording its knowledge and progress along the way.

## [COMPLETE] Phase 1: Bootstrap

Set up a barebones repository with a functioning MCP Server.

## [COMPLETE] Phase 2: Basic Workspaces

Add a minimal feature for managing workspaces. These are directories that have goals in them.

## [TODO] Phase 3: Goal Persistence

### Overview
Implement persistent storage of goals within workspaces, enabling users to track goals, plans, and learnings over time. Each workspace will maintain its own goals and related content in a structured directory hierarchy.

### Background
- Phase 1 established the basic MCP server infrastructure
- Phase 2 implemented workspace management
- Phase 3 will add goal persistence and management within workspaces

### Goals
1. Implement persistent storage of goals within workspaces
2. Enable creation and management of goals with associated plans
3. Support recording of learnings at both workspace and goal levels
4. Track active goal state within workspaces

### Technical Specifications

#### Directory Structure
```plaintext
workspace/
  |-.goals/
    |- state.json
    |- goals/
      |- <goal 1 name>/
        |- plan.md
        |- learnings/
          |- YYYYMMDD.md
      |- <goal 2 name>/
        ...
    |- learnings/
      |- YYYYMMDD.md
```

#### File Formats

##### state.json
```typescript
interface GoalState {
  active_goal: string | null;  // Name of the currently active goal
  last_updated: string;        // ISO timestamp
}
```

##### plan.md
- Markdown format
- Contains implementation plan for completing the goal
- Single file per goal

##### learnings/*.md
- Markdown format
- Filename format: YYYYMMDD.md
- Contains dated entries of learnings
- Can exist at workspace or goal level

#### Required APIs

##### Resources
1. `goals://list` - List all goals in current workspace
2. `goals://{name}` - Get specific goal details
3. `goals://{name}/plan` - Get goal's plan
4. `goals://{name}/learnings` - List goal's learnings
5. `goals://learnings` - List workspace-level learnings

##### Tools
1. `create-goal` - Create new goal with name and optional plan
2. `update-goal-plan` - Update a goal's plan
3. `add-learning` - Add learning (to workspace or specific goal)
4. `set-active-goal` - Set which goal is currently being worked on

### Success Criteria
1. Goals persist across server restarts
2. Goals and learnings are stored in the correct directory structure
3. All APIs return appropriate data and handle errors gracefully
4. Workspace state correctly tracks active goal
5. File operations handle concurrent access safely

### Future Considerations
1. Goal dependencies
2. Goal status tracking (beyond just active/inactive)
3. Rich content in learnings (images, attachments)
4. Goal templates
5. Goal sharing across workspaces

### Implementation Phases
1. Directory structure and file management
2. Goal CRUD operations
3. Learning management
4. State tracking
5. API implementation
6. Testing and validation
