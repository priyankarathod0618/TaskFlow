
import crypto from 'node:crypto';
import { z } from 'zod';
import { Workspace } from '../models/Workspace.js';
import { WorkspaceInvitation } from '../models/WorkspaceInvitation.js';
import { User } from '../models/User.js';
import { getUserWorkspaces } from '../services/workspaceService.js';
import mongoose from 'mongoose';
import {
  canInviteWorkspaceRole,
  canManageWorkspaceMemberRole,
  canRemoveWorkspaceMember
} from '../utils/workspacePermissions.js';

const createSchema = z.object({
  name: z.string().trim().min(2).max(100)
});

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(['admin', 'member', 'viewer']).default('member')
});

const hash = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

const isMember = (workspace, userId) =>
  workspace.members.some(
    m => String(m.user?._id || m.user) === String(userId)
  );

export async function listWorkspaces(req, res) {
  const workspaces = await getUserWorkspaces(req.user._id);

  res.json({
    workspaces: workspaces.map(w => ({
      id: w._id,
      name: w.name,
      role: w.members.find(
        m => String(m.user) === String(req.user._id)
      )?.role,
      owner: w.owner
    }))
  });
}

export async function createWorkspace(req, res) {
  const input = createSchema.parse(req.body || {});

  const workspace = await Workspace.create({
    name: input.name,
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'owner' }]
  });

  res.status(201).json({
    workspace: {
      id: workspace._id,
      name: workspace.name,
      role: 'owner'
    }
  });
}

export async function inviteMember(req, res) {
  const input = inviteSchema.parse(req.body || {});

  if (!canInviteWorkspaceRole(req.workspaceRole, input.role)) {
    return res.status(403).json({
      message: 'Admins can invite members and viewers only. Only the workspace owner can invite an admin.'
    });
  }

  const email = input.email.toLowerCase();
  const member = await User.findOne({ email }).select('_id email');

  if (!member) {
    return res.status(404).json({
      message: 'This user must create a TaskFlow account before they can be invited.'
    });
  }

  if (isMember(req.workspace, member._id)) {
    return res.status(409).json({
      message: 'This user is already a workspace member.'
    });
  }

  const token = crypto.randomBytes(32).toString('hex');

  await WorkspaceInvitation.updateMany(
    {
      workspace: req.workspace._id,
      email,
      acceptedAt: null,
      revokedAt: null
    },
    { revokedAt: new Date() }
  );

  const invitation = await WorkspaceInvitation.create({
    workspace: req.workspace._id,
    email,
    role: input.role,
    tokenHash: hash(token),
    invitedBy: req.user._id,
    expiresAt: new Date(Date.now() + 7 * 86400000)
  });

  res.status(201).json({
    invitation: {
      id: invitation._id,
      email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      token
    }
  });
}

export async function listInvitations(req, res) {
  const invitations = await WorkspaceInvitation.find({
    workspace: req.workspace._id,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  })
    .select('-tokenHash')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ invitations });
}

export async function revokeInvitation(req, res) {
  const invitation = await WorkspaceInvitation.findOneAndUpdate(
    {
      _id: req.params.id,
      workspace: req.workspace._id,
      acceptedAt: null,
      revokedAt: null
    },
    { revokedAt: new Date() },
    { new: true }
  );

  if (!invitation) {
    return res.status(404).json({
      message: 'Active invitation not found.'
    });
  }

  res.json({ message: 'Invitation revoked.' });
}

export async function acceptInvitation(req, res) {
  const token = z.string().min(32).max(256).parse(req.body?.token);

  const invitation = await WorkspaceInvitation.findOne({
    tokenHash: hash(token),
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  });

  if (!invitation) {
    return res.status(404).json({
      message: 'Invitation is invalid, expired, or already used.'
    });
  }

  if (invitation.email !== req.user.email.toLowerCase()) {
    return res.status(403).json({
      message: 'Sign in with the email address this invitation was sent to.'
    });
  }

  const workspace = await Workspace.findById(invitation.workspace);

  if (!workspace) {
    return res.status(404).json({
      message: 'Workspace no longer exists.'
    });
  }

  if (!isMember(workspace, req.user._id)) {
    workspace.members.push({
      user: req.user._id,
      role: invitation.role
    });
  }

  invitation.acceptedAt = new Date();

  await Promise.all([
    workspace.save(),
    invitation.save()
  ]);

  res.json({
    message: 'Invitation accepted.',
    workspace: {
      id: workspace._id,
      name: workspace.name,
      role: invitation.role
    }
  });
}

export async function listMembers(req, res) {
  await req.workspace.populate(
    'members.user',
    'name email title avatarColor'
  );

  res.json({
    members: req.workspace.members.map(m => ({
      user: m.user,
      role: m.role
    }))
  });
}

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer'])
});

export async function updateMemberRole(req, res) {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(400).json({
      message: 'Invalid member ID.'
    });
  }

  const { role } = updateMemberRoleSchema.parse(req.body || {});
  const targetId = String(req.params.userId);
  const actorId = String(req.user._id);
  const ownerId = String(req.workspace.owner);

  if (targetId === ownerId) {
    return res.status(403).json({
      message: 'The workspace owner role cannot be changed.'
    });
  }

  if (targetId === actorId) {
    return res.status(403).json({
      message: 'You cannot change your own workspace role.'
    });
  }

  const target = req.workspace.members.find(
    m => String(m.user?._id || m.user) === targetId
  );

  if (!target) {
    return res.status(404).json({
      message: 'Workspace member not found.'
    });
  }

  if (!canManageWorkspaceMemberRole(req.workspaceRole, target.role, role)) {
    return res.status(403).json({
      message: req.workspaceRole === 'admin'
        ? 'Admins can manage members and viewers only. Only the workspace owner can grant or change the admin role.'
        : 'You do not have permission to change this member role.'
    });
  }

  target.role = role;
  await req.workspace.save();

  res.json({
    message: 'Member role updated successfully.',
    member: { userId: targetId, role: target.role }
  });
}

export async function removeMember(req, res) {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(400).json({
      message: 'Invalid member ID.'
    });
  }

  const targetId = String(req.params.userId);
  const actorId = String(req.user._id);
  const ownerId = String(req.workspace.owner);

  if (targetId === ownerId) {
    return res.status(403).json({
      message: 'The workspace owner cannot be removed.'
    });
  }

  if (targetId === actorId) {
    return res.status(403).json({
      message: 'You cannot remove yourself from this workspace.'
    });
  }

  const target = req.workspace.members.find(
    m => String(m.user?._id || m.user) === targetId
  );

  if (!target) {
    return res.status(404).json({
      message: 'Workspace member not found.'
    });
  }

  if (!canRemoveWorkspaceMember(req.workspaceRole, target.role)) {
    return res.status(403).json({
      message: req.workspaceRole === 'admin'
        ? 'Admins cannot remove another admin or the workspace owner.'
        : 'You do not have permission to remove this member.'
    });
  }

  req.workspace.members = req.workspace.members.filter(
    m => String(m.user?._id || m.user) !== targetId
  );

  await req.workspace.save();

  res.json({ message: 'Member removed successfully.' });
}
