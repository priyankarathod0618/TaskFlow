import mongoose from 'mongoose';
const issueSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  description: { type: String, default: '', maxlength: 10000 },
  severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  status: { type: String, enum: ['Open', 'In progress', 'Resolved', 'Closed'], default: 'Open' },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
issueSchema.index({ workspace: 1, createdAt: -1 });
export const Issue = mongoose.model('Issue', issueSchema);
