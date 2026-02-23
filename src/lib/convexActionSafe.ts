type SafeActionSuccess<T> = {
  ok: true;
  data: T;
  unavailable: false;
  message: "";
  error: null;
};

type SafeActionFailure = {
  ok: false;
  unavailable: boolean;
  message: string;
  error: unknown;
};

export type SafeActionResult<T> = SafeActionSuccess<T> | SafeActionFailure;

const UNAVAILABLE_ACTIONS_STORAGE_KEY = "w-ai-unavailable-convex-actions";
let unavailableActionsCache: Set<string> | null = null;

function getUnavailableActions(): Set<string> {
  if (unavailableActionsCache) return unavailableActionsCache;
  const initial = new Set<string>();
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(UNAVAILABLE_ACTIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) {
          for (const key of parsed) {
            if (typeof key === "string" && key.length > 0) {
              initial.add(key);
            }
          }
        }
      }
    } catch {
      // Ignore storage parse/read failures.
    }
  }
  unavailableActionsCache = initial;
  return unavailableActionsCache;
}

function persistUnavailableActions(cache: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UNAVAILABLE_ACTIONS_STORAGE_KEY, JSON.stringify(Array.from(cache)));
  } catch {
    // Ignore storage write failures.
  }
}

export function isActionKnownUnavailable(actionName: string): boolean {
  return getUnavailableActions().has(actionName);
}

export function markActionUnavailable(actionName: string): void {
  const cache = getUnavailableActions();
  if (cache.has(actionName)) return;
  cache.add(actionName);
  persistUnavailableActions(cache);
}

type SafeActionOptions = {
  actionName?: string;
};

export function isMissingFunctionMessage(message: string): boolean {
  return message.includes("Could not find public function");
}

export async function runConvexActionSafe<TArgs extends Record<string, unknown>, TResult>(
  action: (args: TArgs) => Promise<TResult>,
  args: TArgs,
  options: SafeActionOptions = {}
): Promise<SafeActionResult<TResult>> {
  if (options.actionName && isActionKnownUnavailable(options.actionName)) {
    return {
      ok: false,
      unavailable: true,
      message: `Action ${options.actionName} is unavailable on this deployment.`,
      error: null,
    };
  }

  try {
    const data = await action(args);
    return { ok: true, data, unavailable: false, message: "", error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.actionName && isMissingFunctionMessage(message)) {
      markActionUnavailable(options.actionName);
    }
    return {
      ok: false,
      unavailable: isMissingFunctionMessage(message),
      message,
      error,
    };
  }
}
