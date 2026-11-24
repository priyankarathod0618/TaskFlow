import { Workspace } from '../models/Workspace.js';

export async function ensureWorkspace(user) {
  let workspace = await Workspace.findOne({ 'members.user': user._id });
  if (!workspace) {
    workspace = await Workspace.create({
      name: `${user.name}'s workspace`, owner: user._id,
      members: [{ user: user._id, role: 'owner' }]
    });
  }
  return workspace;
}

export async function getUserWorkspaces(userId) {
  return Workspace.find({ 'members.user': userId }).sort({ createdAt: 1 }).lean();
}
