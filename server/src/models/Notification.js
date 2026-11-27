
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },

  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  type: {
    type: String,
    enum: [
      'general',
      'task_assigned',
      'task_updated',
      'task_comment',
      'mention',
      'project_created',
      'project_updated',
      'issue_created',
      'issue_updated',
      'milestone_created',
      'milestone_updated',
      'timesheet_submitted',
      'timesheet_reviewed',
      'workspace_invitation',
      'member_joined',
      'member_removed',
      'chat_message'
    ],
    default: 'general',
    index: true
  },

  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },

  readAt: {
    type: Date,
    default: null
  },

  link: {
    type: String,
    default: '',
    maxlength: 500,
    validate: {
      validator: (value) =>
        !value ||
        (
          value.startsWith('/') &&
          !value.startsWith('//') &&
          !value.includes('\\')
        ),
      message: 'Notification link must be an internal application path.'
    }
  },

  entityType: {
    type: String,
    enum: ['task', 'project', 'issue', 'milestone', 'timesheet', 'workspace', null],
    default: null
  },

  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  }
}, {
  timestamps: true
});

notificationSchema.index({
  user: 1,
  workspace: 1,
  createdAt: -1
});

notificationSchema.index({
  user: 1,
  workspace: 1,
  readAt: 1,
  createdAt: -1
});

export const Notification = mongoose.model(
  'Notification',
  notificationSchema
);
