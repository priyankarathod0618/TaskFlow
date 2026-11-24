import mongoose from 'mongoose';

export function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}

export function requireText(value, field, { min = 1, max = 5000 } = {}) {
  if (typeof value !== 'string') {
    const error = new Error(`${field} must be a string.`);
    error.status = 400;
    throw error;
  }
  const text = value.trim();
  if (text.length < min || text.length > max) {
    const error = new Error(`${field} must contain between ${min} and ${max} characters.`);
    error.status = 400;
    throw error;
  }
  return text;
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getWorkspaceMember(workspace, userId) {
  return workspace.members.find((member) => String(member.user) === String(userId));
}

export function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
