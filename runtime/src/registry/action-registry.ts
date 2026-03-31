import type { ActionDefinition } from "../types/action.js";
import { RuntimeError } from "../types/errors.js";

export interface RegisteredAction {
  definition: ActionDefinition;
  skillId?: string;
  sourcePath?: string;
}

export interface ActionRegistry {
  resolve(actionId: string): Promise<RegisteredAction>;
  list(actionId: string): Promise<RegisteredAction[]>;
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

  async list(actionId: string): Promise<RegisteredAction[]> {
    return [...(this.actions.get(actionId) ?? [])];
  }

  async resolve(actionId: string): Promise<RegisteredAction> {
    const allEntries = this.actions.get(actionId);
    if (!allEntries || allEntries.length === 0) {
      throw new RuntimeError("ACTION_NOT_FOUND", `Action "${actionId}" was not found.`, {
        action_id: actionId,
      });
    }

    if (allEntries.length === 1) {
      return allEntries[0]!;
    }

    throw new RuntimeError(
      "ACTION_RESOLUTION_AMBIGUOUS",
      `Action "${actionId}" resolved to multiple candidates.`,
      {
        action_id: actionId,
        candidates: allEntries.map((entry) => ({
          skill_id: entry.skillId ?? null,
          source_path: entry.sourcePath ?? null,
        })),
      },
    );
  }
}
