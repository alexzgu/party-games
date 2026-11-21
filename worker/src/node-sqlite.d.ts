// The few pieces of Node's built-in SQLite the tests use (testing.ts): it stands in for a
// Durable Object's SQL storage. The worker itself never imports it.
declare module 'node:sqlite' {
  export interface StatementSync {
    all(...bindings: unknown[]): unknown[];
    run(...bindings: unknown[]): unknown;
    columns(): unknown[];
  }
  export class DatabaseSync {
    constructor(path: string);
    prepare(sql: string): StatementSync;
  }
}
