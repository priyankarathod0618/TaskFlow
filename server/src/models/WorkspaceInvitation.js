import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  role: { type: String, enum: ['admin', 'member', 'viewer'], default: 'member' },
  tokenHash: { type: String, required: true, unique: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  acceptedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null }
}, { timestamps: true });
schema.index({ workspace: 1, email: 1, acceptedAt: 1, revokedAt: 1 });
export const WorkspaceInvitation = mongoose.model('WorkspaceInvitation', schema);
