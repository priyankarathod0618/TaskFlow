import mongoose from 'mongoose';

const workspaceMessageSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

workspaceMessageSchema.index({ workspace: 1, createdAt: -1 });

export const WorkspaceMessage = mongoose.model(
  'WorkspaceMessage',
  workspaceMessageSchema
);
