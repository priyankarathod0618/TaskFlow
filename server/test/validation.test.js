import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeRegex, requireText, getWorkspaceMember, isObjectId } from '../src/utils/validation.js';

test('escapeRegex treats search text literally', () => {
  const pattern = new RegExp(escapeRegex('design (v2)+'));
  assert.equal(pattern.test('design (v2)+'), true);
  assert.equal(pattern.test('design vvv2'), false);
});

test('requireText trims valid strings and rejects empty or oversized values', () => {
  assert.equal(requireText('  Task name  ', 'Task name', { min: 1, max: 20 }), 'Task name');
  assert.throws(() => requireText('   ', 'Task name'), { status: 400 });
  assert.throws(() => requireText('x'.repeat(10), 'Task name', { min: 1, max: 5 }), { status: 400 });
});

test('workspace membership lookup compares ObjectId-like values safely', () => {
  const workspace = { members: [{ user: '65a000000000000000000001', role: 'member' }] };
  assert.equal(getWorkspaceMember(workspace, '65a000000000000000000001').role, 'member');
  assert.equal(getWorkspaceMember(workspace, '65a000000000000000000002'), undefined);
});

test('ObjectId validation rejects malformed identifiers', () => {
  assert.equal(isObjectId('not-an-id'), false);
  assert.equal(isObjectId('65a000000000000000000001'), true);
});
