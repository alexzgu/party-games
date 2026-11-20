// What the Worker gets from Cloudflare. Hand-written so the worker needs no runtime or type
// packages: only the Durable Object pieces this code touches.

export interface Env {
  /** Secret: the Anthropic key the wizard server spends. Never leaves the Worker. */
  ANTHROPIC_API_KEY: string;
  /** Secret: the accepted party phrases, one per line. */
  PARTY_PHRASES: string;
  /** Plain var: comma-separated origins allowed to call from a browser. */
  ALLOWED_ORIGINS: string;
  LIMITS: DurableObjectNamespaceLike;
}

export interface DurableObjectStubLike {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

export interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}
