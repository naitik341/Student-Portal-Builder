import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeFeedbackCursor, encodeFeedbackCursor } from '../src/routes/feedbackCursor.ts';

test('feedback continuation tokens hide the ordering id and are bound to date and meal', () => {
  const position = { date: '2026-09-30', meal: 'Lunch', createdAt: '2026-09-30T12:00:00.000Z', id: 12345 };
  const token = encodeFeedbackCursor(position);
  assert.equal(token.includes('12345'), false);
  assert.deepEqual(decodeFeedbackCursor(token, position.date, position.meal), {
    createdAt: new Date(position.createdAt), id: position.id,
  });
  assert.equal(decodeFeedbackCursor(token, '2026-10-01', position.meal), null);
  assert.equal(decodeFeedbackCursor(token, position.date, 'Dinner'), null);
  assert.equal(decodeFeedbackCursor(`${token.slice(0, -1)}!`, position.date, position.meal), null);
});