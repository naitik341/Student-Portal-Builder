export type Meal = 'Breakfast' | 'Lunch' | 'Dinner';

export interface Submission {
  clientSubmissionId: string;
  deviceId: string;
  mealDate: string;
  meal: Meal;
  items: string[];
  rating: number;
  tags: string[];
  comment: string;
  createdAt: string;
  delivery: 'pending' | 'failed' | 'delivered' | 'rejected';
}

export const SUBMISSIONS_KEY = '@messmate/submissions-v1';
export const OFFLINE_QUEUE_KEY = '@messmate/offline-queue-v1';
export const DEVICE_KEY = '@messmate/device-id-v1';

export interface FeedbackStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiGet(keys: string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiSet(entries: [string, string][]): Promise<void>;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeSubmission(value: unknown, deviceId: string, createId: () => string): Submission {
  const stored = value && typeof value === 'object' ? value as Partial<Submission> : {};
  return {
    ...stored,
    clientSubmissionId: typeof stored.clientSubmissionId === 'string' && stored.clientSubmissionId
      ? stored.clientSubmissionId : createId(),
    deviceId: stored.deviceId || deviceId,
    mealDate: stored.mealDate || localDateKey(new Date(stored.createdAt || new Date().toISOString())),
    delivery: stored.delivery || 'pending',
    meal: stored.meal ?? 'Breakfast',
    items: Array.isArray(stored.items) && stored.items.length > 0 ? stored.items : ['Unspecified item'],
    rating: typeof stored.rating === 'number' ? stored.rating : 3,
    tags: Array.isArray(stored.tags) ? stored.tags : [],
    comment: typeof stored.comment === 'string' ? stored.comment : '',
    createdAt: typeof stored.createdAt === 'string' ? stored.createdAt : new Date().toISOString(),
  };
}

function parseList(raw: string | null, label: string): unknown[] {
  const value: unknown = JSON.parse(raw ?? '[]');
  if (!Array.isArray(value)) throw new Error(`Saved ${label} is invalid.`);
  return value;
}

export async function restoreFeedback(storage: FeedbackStorage, createId: () => string) {
  const values = await storage.multiGet([SUBMISSIONS_KEY, OFFLINE_QUEUE_KEY, DEVICE_KEY]);
  const saved = parseList(values[0][1], 'feedback');
  parseList(values[1][1], 'feedback queue');
  const deviceId = values[2][1] || createId();
  if (!values[2][1]) await storage.setItem(DEVICE_KEY, deviceId);
  const submissions = saved.map((item) => normalizeSubmission(item, deviceId, createId));
  // Rebuild from authoritative local submissions, including older locally saved ratings.
  const queue = submissions.filter((item) => item.delivery === 'pending' || item.delivery === 'failed');
  await storage.multiSet([
    [SUBMISSIONS_KEY, JSON.stringify(submissions)],
    [OFFLINE_QUEUE_KEY, JSON.stringify(queue)],
  ]);
  return { deviceId, submissions, queue };
}

export async function readFeedbackQueue(storage: FeedbackStorage, deviceId: string, createId: () => string) {
  const stored = parseList(await storage.getItem(OFFLINE_QUEUE_KEY), 'feedback queue');
  const queue = stored.map((item) => normalizeSubmission(item, deviceId, createId));
  if (JSON.stringify(queue) !== JSON.stringify(stored)) {
    await storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }
  return queue;
}

export async function saveFeedback(
  storage: FeedbackStorage,
  submission: Submission,
  deviceId: string,
  createId: () => string,
): Promise<{ submissions: Submission[]; queue: Submission[] } | null> {
  const submissions = parseList(await storage.getItem(SUBMISSIONS_KEY), 'feedback')
    .map((item) => normalizeSubmission(item, deviceId, createId));
  const queue = await readFeedbackQueue(storage, deviceId, createId);
  if ([...submissions, ...queue].some((item) =>
    item.meal === submission.meal && item.mealDate === submission.mealDate)) return null;
  const updated = [...submissions, submission];
  const appended = [...queue, submission];
  await storage.multiSet([
    [SUBMISSIONS_KEY, JSON.stringify(updated)],
    [OFFLINE_QUEUE_KEY, JSON.stringify(appended)],
  ]);
  return { submissions: updated, queue: appended };
}

export async function deliverFeedback(
  storage: FeedbackStorage,
  pending: Submission,
  deviceId: string,
  createId: () => string,
  send: (submission: Submission) => Promise<{ clientSubmissionId: string }>,
  withStorageLock: <T>(operation: () => Promise<T>) => Promise<T>,
): Promise<{ submissions: Submission[]; queue: Submission[]; error?: unknown }> {
  let delivery: Submission['delivery'] = 'delivered';
  let error: unknown;
  try {
    const receipt = await send(pending);
    if (receipt.clientSubmissionId !== pending.clientSubmissionId) throw new Error('Mismatched receipt');
  } catch (cause) {
    if (cause && typeof cause === 'object' && 'status' in cause && cause.status === 409) {
      delivery = 'rejected';
    } else {
      delivery = 'failed';
      error = cause ?? new Error('Feedback delivery failed');
    }
  }
  // The request above must not hold the storage lock: another meal can be
  // saved locally while an earlier delivery is stalled.
  return withStorageLock(async () => {
    const saved = parseList(await storage.getItem(SUBMISSIONS_KEY), 'feedback');
    const submissions = saved.map((item) => {
      const submission = normalizeSubmission(item, deviceId, createId);
      return submission.clientSubmissionId === pending.clientSubmissionId
        ? { ...submission, delivery } : submission;
    });
    if (error) {
      await storage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
      return { submissions, queue: await readFeedbackQueue(storage, deviceId, createId), error };
    }
    const queue = (await readFeedbackQueue(storage, deviceId, createId))
      .filter((item) => item.clientSubmissionId !== pending.clientSubmissionId);
    await storage.multiSet([
      [SUBMISSIONS_KEY, JSON.stringify(submissions)],
      [OFFLINE_QUEUE_KEY, JSON.stringify(queue)],
    ]);
    return { submissions, queue };
  });
}