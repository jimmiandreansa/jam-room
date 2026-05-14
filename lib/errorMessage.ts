/**
 * Reads a human-readable message from thrown values, including PostgREST-style
 * objects that are not `instanceof Error`.
 */
export function getErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m.length) return m;
  }
  if (typeof e === "string" && e.length) return e;
  return fallback;
}
