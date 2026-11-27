
export const WORKSPACE_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer'
});

export const WORKSPACE_ROLE_GROUPS = Object.freeze({
  managers: Object.freeze([WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN]),
  contributors: Object.freeze([
    WORKSPACE_ROLES.OWNER,
    WORKSPACE_ROLES.ADMIN,
    WORKSPACE_ROLES.MEMBER
  ]),
  members: Object.freeze([
    WORKSPACE_ROLES.OWNER,
    WORKSPACE_ROLES.ADMIN,
    WORKSPACE_ROLES.MEMBER,
    WORKSPACE_ROLES.VIEWER
  ])
});

export function hasWorkspaceRole(role, allowedRoles) {
  return allowedRoles.includes(role);
}

export function isWorkspaceManager(role) {
  return hasWorkspaceRole(role, WORKSPACE_ROLE_GROUPS.managers);
}

export function canInviteWorkspaceRole(actorRole, invitedRole) {
  if (actorRole === WORKSPACE_ROLES.OWNER) {
    return [WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.MEMBER, WORKSPACE_ROLES.VIEWER]
      .includes(invitedRole);
  }

  if (actorRole === WORKSPACE_ROLES.ADMIN) {
    return [WORKSPACE_ROLES.MEMBER, WORKSPACE_ROLES.VIEWER]
      .includes(invitedRole);
  }

  return false;
}

export function canManageWorkspaceMemberRole(actorRole, targetRole, nextRole) {
  if (targetRole === WORKSPACE_ROLES.OWNER || nextRole === WORKSPACE_ROLES.OWNER) {
    return false;
  }

  if (actorRole === WORKSPACE_ROLES.OWNER) return true;

  if (actorRole === WORKSPACE_ROLES.ADMIN) {
    return targetRole !== WORKSPACE_ROLES.ADMIN &&
      nextRole !== WORKSPACE_ROLES.ADMIN;
  }

  return false;
}

export function canRemoveWorkspaceMember(actorRole, targetRole) {
  if (targetRole === WORKSPACE_ROLES.OWNER) return false;
  if (actorRole === WORKSPACE_ROLES.OWNER) return true;
  if (actorRole === WORKSPACE_ROLES.ADMIN) {
    return targetRole !== WORKSPACE_ROLES.ADMIN;
  }
  return false;
}

export function canEditWorkspaceRecord(role, actorId, record) {
  if (isWorkspaceManager(role)) return true;
  if (role !== WORKSPACE_ROLES.MEMBER) return false;

  const userId = String(actorId);
  return String(record.reporter || '') === userId ||
    String(record.assignee || '') === userId;
}
