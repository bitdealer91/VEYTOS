export type RpcReadOptions = {
  retries?: number;
  retryBaseMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  onRateLimit?: (delayMs: number, attempt: number) => void;
};

type HttpLikeError = {
  status?: unknown;
  headers?: { get?: (name: string) => string | null };
  response?: { status?: unknown; headers?: { get?: (name: string) => string | null } };
  message?: unknown;
};

export function isRateLimitError(error: unknown) {
  const value = error as HttpLikeError;
  return Number(value?.status) === 429 || Number(value?.response?.status) === 429 || /\b429\b|too many requests/i.test(String(value?.message ?? error));
}

function retryAfterMs(error: unknown) {
  const value = error as HttpLikeError;
  const raw = value?.response?.headers?.get?.('retry-after') ?? value?.headers?.get?.('retry-after');
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, Math.min(date - Date.now(), 30_000)) : null;
}

/** Coalesces identical reads and coordinates bounded rate-limit retries per Aptos client. */
export class RpcReadCoordinator {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private cooldownUntil = 0;

  run<T>(key: string, operation: () => Promise<T>, options: RpcReadOptions = {}): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const task = this.execute(operation, options).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, task);
    return task;
  }

  private async execute<T>(operation: () => Promise<T>, options: RpcReadOptions): Promise<T> {
    const retries = options.retries ?? 2;
    const base = options.retryBaseMs ?? 1000;
    const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    const random = options.random ?? Math.random;
    for (let attempt = 0; ; attempt += 1) {
      const gate = this.cooldownUntil - Date.now();
      if (gate > 0) await sleep(gate);
      try { return await operation(); }
      catch (error) {
        if (!isRateLimitError(error) || attempt >= retries) throw error;
        const explicit = retryAfterMs(error);
        const exponential = Math.min(base * 2 ** attempt, 8000);
        const delay = explicit ?? Math.round(exponential * (0.9 + random() * 0.2));
        this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + delay);
        options.onRateLimit?.(delay, attempt + 1);
      }
    }
  }
}

const coordinators = new WeakMap<object, RpcReadCoordinator>();
export function rpcReadCoordinator(client: object) {
  let coordinator = coordinators.get(client);
  if (!coordinator) { coordinator = new RpcReadCoordinator(); coordinators.set(client, coordinator); }
  return coordinator;
}
