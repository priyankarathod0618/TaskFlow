import mongoose from 'mongoose';
const timeEntrySchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, default: Date.now, required: true },
  hours: { type: Number, min: 0.1, max: 24, required: true },
  note: { type: String, default: '', maxlength: 2000 },
  billable: { type: Boolean, default: true }
}, { timestamps: true });
timeEntrySchema.index({ workspace: 1, user: 1, date: -1 });
export const TimeEntry = mongoose.model('TimeEntry', timeEntrySchema);
