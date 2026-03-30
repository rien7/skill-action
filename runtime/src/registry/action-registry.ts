import type { ActionDefinition } from "../types/action.js";
import { RuntimeError } from "../types/errors.js";

export interface RegisteredAction {
  definition: ActionDefinition;
  skillId?: string;
  sourcePath?: string;
}

export interface ActionRegistry {
  resolve(actionId: string, version?: string): Promise<RegisteredAction>;
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

  async resolve(actionId: string, version?: string): Promise<RegisteredAction> {
    const entries = this.actions.get(actionId);
    if (!entries || entries.length === 0) {
      throw new RuntimeError("ACTION_NOT_FOUND", `Action "${actionId}" was not found.`, {
        action_id: actionId,
      });
    }

    if (!version) {
      return entries[entries.length - 1]!;
    }

    const match = entries.find((entry) => entry.definition.version === version);
    if (!match) {
      throw new RuntimeError(
        "VERSION_NOT_FOUND",
        `Version "${version}" was not found for action "${actionId}".`,
        {
          action_id: actionId,
          version,
        },
      );
    }

    return match;
  }
}

