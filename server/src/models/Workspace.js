import mongoose from 'mongoose';
const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], default: 'member' }
  }]
}, { timestamps: true });
workspaceSchema.index({ 'members.user': 1 });
export const Workspace = mongoose.model('Workspace', workspaceSchema);
