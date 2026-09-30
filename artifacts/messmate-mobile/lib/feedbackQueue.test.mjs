import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEVICE_KEY, OFFLINE_QUEUE_KEY, SUBMISSIONS_KEY,
  deliverFeedback, readFeedbackQueue, restoreFeedback, saveFeedback,
} from './feedbackQueue.ts';

function storage() {
  const values = new Map();
  return {
    values,
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async multiGet(keys) { return keys.map((key) => [key, values.get(key) ?? null]); },
    async multiSet(entries) { entries.forEach(([key, value]) => values.set(key, value)); },
  };
}

const createId = () => 'generated-id';
const unlocked = (operation) => operation();
const sample = {
  clientSubmissionId: 'rating-1', deviceId: 'install-1', mealDate: '2026-09-30',
  meal: 'Lunch', items: ['Rice'], rating: 4, tags: ['Tasty'], comment: '',
  createdAt: '2026-09-30T12:00:00.000Z', delivery: 'pending',
};

test('offline save survives reopening and sends the same ID on reconnection', async () => {
  const store = storage();
  const firstOpen = await restoreFeedback(store, () => 'install-1');
  assert.equal(firstOpen.deviceId, 'install-1');
  assert.equal(store.values.get(DEVICE_KEY), 'install-1');
  const saved = await saveFeedback(store, sample, firstOpen.deviceId, createId);
  assert.equal(saved.queue.length, 1);
  assert.equal(saved.submissions[0].delivery, 'pending');
  assert.equal(await saveFeedback(store, { ...sample, clientSubmissionId: 'rating-2' }, 'install-1', createId), null);

  // A new screen instance reads only persisted storage, not in-memory state.
  const reopened = await restoreFeedback(store, createId);
  assert.deepEqual(reopened.queue, [sample]);
  const sent = [];
  const result = await deliverFeedback(store, reopened.queue[0], reopened.deviceId, createId, async (item) => {
    sent.push(item.clientSubmissionId);
    return { clientSubmissionId: item.clientSubmissionId };
  }, unlocked);
  assert.deepEqual(sent, ['rating-1']);
  assert.deepEqual(result.queue, []);
  assert.equal(result.submissions[0].delivery, 'delivered');
  assert.deepEqual((await restoreFeedback(store, createId)).queue, []);
});

test('failed delivery stays queued across restart; an idempotent retry clears it', async () => {
  const store = storage();
  await restoreFeedback(store, () => 'install-1');
  await saveFeedback(store, sample, 'install-1', createId);
  const failure = await deliverFeedback(store, sample, 'install-1', createId, async () => {
    throw new Error('network unavailable');
  }, unlocked);
  assert.match(failure.error.message, /network unavailable/);
  assert.equal(failure.submissions[0].delivery, 'failed');
  assert.deepEqual(failure.queue, [sample]);

  const reopened = await restoreFeedback(store, createId);
  assert.equal(reopened.queue[0].clientSubmissionId, sample.clientSubmissionId);
  const retry = await deliverFeedback(store, reopened.queue[0], 'install-1', createId,
    async () => ({ clientSubmissionId: sample.clientSubmissionId }), unlocked);
  assert.equal(retry.submissions[0].delivery, 'delivered');
  assert.equal((await readFeedbackQueue(store, 'install-1', createId)).length, 0);
});

test('reopening rebuilds a lost queue entry from locally saved pending feedback', async () => {
  const store = storage();
  await restoreFeedback(store, () => 'install-1');
  await saveFeedback(store, sample, 'install-1', createId);
  store.values.set(OFFLINE_QUEUE_KEY, '[]');
  const reopened = await restoreFeedback(store, createId);
  assert.deepEqual(reopened.queue, [sample]);
  assert.deepEqual(await readFeedbackQueue(store, 'install-1', createId), [sample]);
});

test('a rejected duplicate is marked rejected and never retried', async () => {
  const store = storage();
  await restoreFeedback(store, () => 'install-1');
  await saveFeedback(store, sample, 'install-1', createId);
  const rejected = await deliverFeedback(store, sample, 'install-1', createId, async () => {
    throw Object.assign(new Error('conflict'), { status: 409 });
  }, unlocked);
  assert.equal(rejected.error, undefined);
  assert.equal(rejected.submissions[0].delivery, 'rejected');
  assert.deepEqual(rejected.queue, []);
  assert.deepEqual((await restoreFeedback(store, createId)).queue, []);
});

test('invalid saved queue fails visibly instead of silently discarding feedback', async () => {
  const store = storage();
  store.values.set(SUBMISSIONS_KEY, JSON.stringify([sample]));
  store.values.set(OFFLINE_QUEUE_KEY, '{broken');
  await assert.rejects(restoreFeedback(store, createId), SyntaxError);
});

test('saving another meal does not wait for an unresolved delivery', async () => {
  const store = storage();
  await restoreFeedback(store, () => 'install-1');
  await saveFeedback(store, sample, 'install-1', createId);
  let release;
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const pendingRequest = new Promise((resolve) => { release = resolve; });
  let tail = Promise.resolve();
  const withLock = async (operation) => {
    const predecessor = tail;
    let unlock;
    tail = new Promise((resolve) => { unlock = resolve; });
    await predecessor;
    try { return await operation(); } finally { unlock(); }
  };
  const delivering = deliverFeedback(store, sample, 'install-1', createId, async () => {
    entered();
    return pendingRequest;
  }, withLock);
  await started;
  const dinner = { ...sample, clientSubmissionId: 'rating-dinner', meal: 'Dinner' };
  const saved = await Promise.race([
    withLock(() => saveFeedback(store, dinner, 'install-1', createId)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('save blocked by network')), 500)),
  ]);
  assert.equal(saved.submissions.length, 2);
  // Reopening before the stalled request completes must retain both ratings.
  assert.equal((await restoreFeedback(store, createId)).queue.length, 2);
  release({ clientSubmissionId: sample.clientSubmissionId });
  const result = await delivering;
  assert.deepEqual(result.queue.map((item) => item.clientSubmissionId), ['rating-dinner']);
  assert.equal(result.submissions.length, 2);
});