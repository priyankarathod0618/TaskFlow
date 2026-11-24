import mongoose from 'mongoose';
const projectSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true, uppercase: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['Planning','Active','On hold','Completed','Archived'], default: 'Active' },
  priority: { type: String, enum: ['Low','Medium','High','Critical'], default: 'Medium' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startDate: Date, dueDate: Date, color: { type: String, default: '#6574df' },
  archivedAt: Date
}, { timestamps: true });
export const Project = mongoose.model('Project', projectSchema);
