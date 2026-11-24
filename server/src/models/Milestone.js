import mongoose from 'mongoose';
const milestoneSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
  description: { type: String, default: '', maxlength: 10000 },
  dueDate: Date,
  status: { type: String, enum: ['Upcoming', 'In progress', 'Completed'], default: 'Upcoming' }
}, { timestamps: true });
milestoneSchema.index({ workspace: 1, dueDate: 1 });
export const Milestone = mongoose.model('Milestone', milestoneSchema);
