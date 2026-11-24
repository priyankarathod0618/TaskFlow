import mongoose from 'mongoose';
const timesheetSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  entries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TimeEntry' }],
  totalHours: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['Draft', 'Submitted', 'Approved', 'Rejected'], default: 'Submitted' },
  submittedAt: Date,
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNote: { type: String, default: '' },
  history: [{ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, action: String, note: String, at: { type: Date, default: Date.now } }]
}, { timestamps: true });
timesheetSchema.index({ workspace: 1, user: 1, weekStart: 1 }, { unique: true });
export const Timesheet = mongoose.model('Timesheet', timesheetSchema);
