import pLimit from "p-limit";
import pRetry from "p-retry";

export interface BatchOptions {
  concurrency?: number;
  retries?: number;
}

export function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 429
  );
}

export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: BatchOptions = {},
): Promise<R[]> {
  const limit = pLimit(options.concurrency ?? 2);
  return Promise.all(
    items.map((item, index) =>
      limit(() =>
        pRetry(() => processor(item, index), {
          retries: options.retries ?? 5,
          shouldRetry: ({ error }) => isRateLimitError(error),
        }),
      ),
    ),
  );
}

export async function batchProcessWithSSE<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  sendEvent: (event: { index: number; result: R } | { done: true }) => void,
  options: BatchOptions = {},
): Promise<R[]> {
  const results: R[] = [];
  for (const [index, item] of items.entries()) {
    const [result] = await batchProcess([item], (value) => processor(value, index), {
      ...options,
      concurrency: 1,
    });
    results.push(result);
    sendEvent({ index, result });
  }
  sendEvent({ done: true });
  return results;
}