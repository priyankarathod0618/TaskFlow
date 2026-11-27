
import { Notification } from '../models/Notification.js';

function getUserId(value) {
  if (!value) return null;
  return String(value._id || value);
}

export async function createNotification({
  userId,
  workspaceId,
  message,
  link = ''
}) {
  if (!userId || !workspaceId) {
    throw new Error('A user and workspace are required to create a notification.');
  }

  const cleanMessage = String(message || '').trim();

  if (!cleanMessage) {
    throw new Error('Notification message cannot be empty.');
  }

  return Notification.create({
    user: userId,
    workspace: workspaceId,
    message: cleanMessage.slice(0, 500),
    link
  });
}

export async function createNotifications({
  userIds = [],
  workspaceId,
  message,
  link = '',
  excludeUserIds = []
}) {
  if (!workspaceId) {
    throw new Error('A workspace is required to create notifications.');
  }

  const excluded = new Set(
    excludeUserIds.map(getUserId).filter(Boolean)
  );

  const recipients = [
    ...new Set(userIds.map(getUserId).filter(Boolean))
  ].filter(userId => !excluded.has(userId));

  if (!recipients.length) {
    return [];
  }

  const cleanMessage = String(message || '').trim();

  if (!cleanMessage) {
    throw new Error('Notification message cannot be empty.');
  }

  return Notification.insertMany(
    recipients.map(userId => ({
      user: userId,
      workspace: workspaceId,
      message: cleanMessage.slice(0, 500),
      link
    }))
  );
}

export async function notifyWorkspaceMembers({
  workspace,
  actorId,
  message,
  link = '',
  roles
}) {
  if (!workspace?._id || !Array.isArray(workspace.members)) {
    throw new Error('A valid workspace with members is required.');
  }

  const members = workspace.members.filter(member => {
    if (roles?.length && !roles.includes(member.role)) {
      return false;
    }

    return true;
  });

  return createNotifications({
    userIds: members.map(member => member.user),
    workspaceId: workspace._id,
    message,
    link,
    excludeUserIds: actorId ? [actorId] : []
  });
}

export async function notifyWorkspaceManagers({
  workspace,
  actorId,
  message,
  link = ''
}) {
  return notifyWorkspaceMembers({
    workspace,
    actorId,
    message,
    link,
    roles: ['owner', 'admin']
  });
}
