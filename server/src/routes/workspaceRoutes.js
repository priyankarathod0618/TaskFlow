
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { attachWorkspace, requireWorkspaceRole } from '../middleware/workspace.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as workspaces from '../controllers/workspaceController.js';
import { WORKSPACE_ROLE_GROUPS } from '../utils/workspacePermissions.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(workspaces.listWorkspaces));
router.post('/', asyncHandler(workspaces.createWorkspace));
router.post('/invitations/accept', asyncHandler(workspaces.acceptInvitation));

router.use(attachWorkspace);

router.get('/members', asyncHandler(workspaces.listMembers));

router.get(
  '/invitations',
  requireWorkspaceRole(...WORKSPACE_ROLE_GROUPS.managers),
  asyncHandler(workspaces.listInvitations)
);

router.post(
  '/invitations',
  requireWorkspaceRole(...WORKSPACE_ROLE_GROUPS.managers),
  asyncHandler(workspaces.inviteMember)
);

router.delete(
  '/invitations/:id',
  requireWorkspaceRole(...WORKSPACE_ROLE_GROUPS.managers),
  asyncHandler(workspaces.revokeInvitation)
);

router.patch(
  '/members/:userId/role',
  requireWorkspaceRole(...WORKSPACE_ROLE_GROUPS.managers),
  asyncHandler(workspaces.updateMemberRole)
);

router.delete(
  '/members/:userId',
  requireWorkspaceRole(...WORKSPACE_ROLE_GROUPS.managers),
  asyncHandler(workspaces.removeMember)
);

export default router;
