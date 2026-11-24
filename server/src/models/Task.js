import mongoose from 'mongoose';
const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  createdAt: { type: Date, default: Date.now }
});
const activitySchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, maxlength: 80 },
  detail: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });
const taskSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  description: { type: String, default: '', maxlength: 10000 },
  status: { type: String, enum: ['Backlog', 'To do', 'In progress', 'In review', 'Done'], default: 'To do' },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dueDate: Date,
  startDate: Date,
  labels: { type: [String], default: [], validate: (items) => items.length <= 30 },
  estimateHours: { type: Number, min: 0, max: 100000, default: 0 },
  loggedHours: { type: Number, min: 0, max: 1000000, default: 0 },
  parentTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  comments: { type: [commentSchema], default: [] },
  activity: { type: [activitySchema], default: [] }
}, { timestamps: true });
taskSchema.index({ workspace: 1, project: 1, updatedAt: -1 });
export const Task = mongoose.model('Task', taskSchema);
