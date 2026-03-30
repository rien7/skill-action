import type { ActionDefinition } from "../types/action.js";
import { RuntimeError } from "../types/errors.js";

export interface RegisteredAction {
  definition: ActionDefinition;
  skillId?: string;
  sourcePath?: string;
}

export interface ActionRegistry {
  resolve(actionId: string, version?: string): Promise<RegisteredAction>;
  list(actionId: string, version?: string): Promise<RegisteredAction[]>;
}

export class InMemoryActionRegistry implements ActionRegistry {
  private readonly actions = new Map<string, RegisteredAction[]>();

  constructor(initialActions: RegisteredAction[] = []) {
    for (const action of initialActions) {
      this.register(action);
    }
  }

  register(action: RegisteredAction): void {
    const existing = this.actions.get(action.definition.action_id) ?? [];
    existing.push(action);
    this.actions.set(action.definition.action_id, existing);
  }

  async list(actionId: string, version?: string): Promise<RegisteredAction[]> {
    const entries = this.actions.get(actionId) ?? [];
    if (!version) {
      return [...entries];
    }

    return entries.filter((entry) => entry.definition.version === version);
  }

  async resolve(actionId: string, version?: string): Promise<RegisteredAction> {
    const allEntries = this.actions.get(actionId);
    if (!allEntries || allEntries.length === 0) {
      throw new RuntimeError("ACTION_NOT_FOUND", `Action "${actionId}" was not found.`, {
        action_id: actionId,
      });
    }

    if (!version) {
      return allEntries[allEntries.length - 1]!;
    }

    const entries = allEntries.filter((entry) => entry.definition.version === version);
    if (entries.length === 0) {
      throw new RuntimeError(
        "VERSION_NOT_FOUND",
        `Version "${version}" was not found for action "${actionId}".`,
        {
          action_id: actionId,
          version,
        },
      );
    }

    return entries[0]!;
  }
}
