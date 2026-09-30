import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

// Use the same PostgreSQL driver as @workspace/db without adding an API runtime dependency.
const requireFromDb = createRequire(new URL('../../../lib/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const endpoint = process.env.FEEDBACK_API_BASE_URL ?? 'http://localhost:80/api/feedback';

function payload(id = `feedback-test-${randomUUID()}`, deviceId = `test-device-${randomUUID()}`) {
  return {
    clientSubmissionId: id, deviceId, mealDate: '2026-09-30', meal: 'Lunch',
    items: ['Rice'], rating: 4, tags: ['Tasty'], comment: 'Good',
    createdAt: '2026-09-30T12:00:00.000Z',
  };
}

async function submit(body) {
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function count(id) {
  const result = await pool.query('SELECT count(*)::integer AS total FROM feedback WHERE client_submission_id = $1', [id]);
  return result.rows[0].total;
}

async function clean(ids) {
  await pool.query('DELETE FROM feedback WHERE client_submission_id = ANY($1::text[])', [ids]);
}

test('API returns 201 once, 200 for an identical retry, and 409 for conflicting duplicates', async () => {
  const first = payload();
  const differentId = payload(undefined, first.deviceId);
  const ids = [first.clientSubmissionId, differentId.clientSubmissionId];
  try {
    const created = await submit(first);
    assert.equal(created.status, 201);
    assert.deepEqual(created.body, {
      clientSubmissionId: first.clientSubmissionId, createdAt: first.createdAt, duplicate: false,
    });
    const retry = await submit(first);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.duplicate, true);
    assert.equal(retry.body.clientSubmissionId, first.clientSubmissionId);
    assert.equal((await submit({ ...first, rating: 1 })).status, 409);
    assert.equal((await submit(differentId)).status, 409); // same device, meal and date
    assert.equal(await count(first.clientSubmissionId), 1);
    assert.equal(await count(differentId.clientSubmissionId), 0);
  } finally {
    await clean(ids);
  }
});

test('parallel HTTP retries persist exactly one rating', async () => {
  const first = payload();
  try {
    const responses = await Promise.all(Array.from({ length: 8 }, () => submit(first)));
    assert.equal(responses.filter((result) => result.status === 201).length, 1);
    assert.equal(responses.filter((result) => result.status === 200).length, 7);
    assert.ok(responses.every((result) => result.body.clientSubmissionId === first.clientSubmissionId));
    assert.equal(await count(first.clientSubmissionId), 1);
  } finally {
    await clean([first.clientSubmissionId]);
  }
});

test('parallel competing ratings from the same installation produce one 201 and one 409', async () => {
  const first = payload();
  const second = payload(undefined, first.deviceId);
  const ids = [first.clientSubmissionId, second.clientSubmissionId];
  try {
    const responses = await Promise.all([submit(first), submit(second)]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    const rows = await pool.query(
      'SELECT count(*)::integer AS total FROM feedback WHERE client_submission_id = ANY($1::text[])',
      [ids],
    );
    assert.equal(rows.rows[0].total, 1);
  } finally {
    await clean(ids);
  }
});

test('database unique index rejects simultaneous ratings for the same installation, meal and day', async () => {
  const first = payload();
  const second = payload(undefined, first.deviceId);
  const ids = [first.clientSubmissionId, second.clientSubmissionId];
  const insert = (item) => pool.query(
    `INSERT INTO feedback (client_submission_id, device_id, meal_date, meal, items, rating, tags, comment, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9)`,
    [item.clientSubmissionId, item.deviceId, item.mealDate, item.meal,
      JSON.stringify(item.items), item.rating, JSON.stringify(item.tags), item.comment, item.createdAt],
  );
  try {
    const outcomes = await Promise.allSettled([insert(first), insert(second)]);
    assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = outcomes.find((result) => result.status === 'rejected');
    assert.equal(rejected.reason.code, '23505');
    const rows = await pool.query(
      'SELECT count(*)::integer AS total FROM feedback WHERE client_submission_id = ANY($1::text[])',
      [ids],
    );
    assert.equal(rows.rows[0].total, 1);
  } finally {
    await clean(ids);
  }
});

test('checked-in migrations create the feedback uniqueness rule in an empty schema', async () => {
  const schema = `feedback_test_${randomUUID().replaceAll('-', '')}`;
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    for (const filename of ['0000_useful_layla_miller.sql', '0001_careless_solo.sql']) {
      const sql = await readFile(new URL(`../../../lib/db/drizzle/${filename}`, import.meta.url), 'utf8');
      await client.query(sql.replaceAll('--> statement-breakpoint', ''));
    }
    const first = payload();
    const second = payload(undefined, first.deviceId);
    const insert = (item) => client.query(
      `INSERT INTO feedback (client_submission_id, device_id, meal_date, meal, items, rating, tags, comment, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9) ON CONFLICT DO NOTHING RETURNING id`,
      [item.clientSubmissionId, item.deviceId, item.mealDate, item.meal,
        JSON.stringify(item.items), item.rating, JSON.stringify(item.tags), item.comment, item.createdAt],
    );
    assert.equal((await insert(first)).rowCount, 1);
    assert.equal((await insert(second)).rowCount, 0);
    assert.equal((await client.query('SELECT count(*)::integer AS total FROM feedback')).rows[0].total, 1);
  } finally {
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client.release();
  }
});

test.after(async () => { await pool.end(); });