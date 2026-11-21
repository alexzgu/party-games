// What the Worker gets from Cloudflare. Hand-written so the worker needs no runtime or type
// packages: only the Durable Object pieces this code touches.

export interface Env {
  /** Secret: the Anthropic key the wizard server spends. Never leaves the Worker. */
  ANTHROPIC_API_KEY: string;
  /** Secret: the accepted party phrases, one per line. */
  PARTY_PHRASES: string;
  /** Plain var: comma-separated origins allowed to call from a browser. */
  ALLOWED_ORIGINS: string;
  /**
   * Optional secret: lets the owner hide a library pack (POST /library/packs/:id/hide). Unset,
   * that route always refuses.
   */
  LIBRARY_ADMIN?: string;
  LIMITS: DurableObjectNamespaceLike;
  /** The community pack library (libraryObject.ts). */
  LIBRARY: DurableObjectNamespaceLike;
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

/** A SQL value Cloudflare binds: no booleans, so flags are 0 or 1. */
export type SqlValue = string | number | null;

/** What `sql.exec` returns: the rows of a SELECT (or RETURNING), none for other statements. */
export interface SqlCursorLike<T> {
  toArray(): T[];
}

/** A SQLite-backed Durable Object's storage (`ctx.storage.sql`). */
export interface SqlStorageLike {
  exec<T = Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]): SqlCursorLike<T>;
}

export interface SqlStateLike {
  storage: { sql: SqlStorageLike };
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}
