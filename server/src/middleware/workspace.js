
import mongoose from 'mongoose';
import { Workspace } from '../models/Workspace.js';
import { ensureWorkspace } from '../services/workspaceService.js';
import { hasWorkspaceRole } from '../utils/workspacePermissions.js';

export async function attachWorkspace(req, res, next) {
  try {
    const requestedId = req.get('x-workspace-id');
    let workspace;

    if (requestedId) {
      if (!mongoose.isValidObjectId(requestedId)) {
        return res.status(400).json({
          message: 'Invalid workspace selection.'
        });
      }

      workspace = await Workspace.findOne({
        _id: requestedId,
        'members.user': req.user._id
      });

      if (!workspace) {
        return res.status(403).json({
          message: 'You are not a member of the selected workspace.'
        });
      }
    } else {
      const workspaces = await Workspace.find({
        'members.user': req.user._id
      }).sort({ createdAt: 1 }).limit(2);

      if (workspaces.length > 1) {
        return res.status(400).json({
          message: 'Please select a workspace before continuing.'
        });
      }

      workspace = workspaces[0] || await ensureWorkspace(req.user);
    }

    const member = workspace.members.find(
      entry =>
        String(entry.user?._id || entry.user) === String(req.user._id)
    );

    if (!member) {
      return res.status(403).json({
        message: 'You are not an active member of this workspace.'
      });
    }

    const isWorkspaceOwner =
      String(workspace.owner) === String(req.user._id);

    if (member.role === 'owner' && !isWorkspaceOwner) {
      return res.status(403).json({
        message: 'Workspace owner membership is inconsistent. Contact the workspace owner.'
      });
    }

    req.workspace = workspace;
    // The workspace owner field is the source of truth for ownership.
    req.workspaceRole = isWorkspaceOwner ? 'owner' : member.role;

    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireWorkspaceRole(...roles) {
  return (req, res, next) => {
    if (!hasWorkspaceRole(req.workspaceRole, roles)) {
      return res.status(403).json({
        message: 'You do not have permission to perform this action.'
      });
    }

    next();
  };
}
