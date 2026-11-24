import test from 'node:test';
import assert from 'node:assert/strict';
import { requireWorkspaceRole } from '../src/middleware/workspace.js';

function runGuard(role, allowedRoles) {
  const req = { workspaceRole: role };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  let nextCalled = false;
  requireWorkspaceRole(...allowedRoles)(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('workspace role guard allows a permitted role', () => {
  const result = runGuard('admin', ['owner', 'admin']);
  assert.equal(result.nextCalled, true);
  assert.equal(result.res.statusCode, 200);
});

test('workspace role guard denies a viewer from write permissions', () => {
  const result = runGuard('viewer', ['owner', 'admin', 'member']);
  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 403);
  assert.equal(result.res.body.message, 'You do not have permission to perform this action.');
});


test('workspace role guard allows a member on contributor routes', () => {
  const result = runGuard('member', ['owner', 'admin', 'member']);
  assert.equal(result.nextCalled, true);
});

test('workspace role guard allows the owner on manager routes', () => {
  const result = runGuard('owner', ['owner', 'admin']);
  assert.equal(result.nextCalled, true);
});
