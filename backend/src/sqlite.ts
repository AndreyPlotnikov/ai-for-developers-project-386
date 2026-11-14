import type { DatabaseSync } from "node:sqlite";

export function withImmediateTransaction<T>(
  database: DatabaseSync,
  operation: () => T,
  afterRollback?: (error: unknown) => void,
): T {
  // Reserve the write lock before reading data that determines the write.
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    if (database.isTransaction) {
      database.exec("ROLLBACK");
      afterRollback?.(error);
    }
    throw error;
  }
}
