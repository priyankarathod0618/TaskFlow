
import mongoose from 'mongoose';
import { Workspace } from '../models/Workspace.js';
import { ensureWorkspace } from '../services/workspaceService.js';

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

    req.workspace = workspace;
    req.workspaceRole = member.role;

    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireWorkspaceRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.workspaceRole)) {
      return res.status(403).json({
        message: 'You do not have permission to perform this action.'
      });
    }

    next();
  };
}
