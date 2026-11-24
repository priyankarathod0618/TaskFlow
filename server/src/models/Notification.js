import mongoose from 'mongoose';
const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  readAt: Date,
  link: { type: String, default: '', maxlength: 500, validate: {
    validator: (value) => !value || (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')),
    message: 'Notification link must be an internal application path.'
  } }
}, { timestamps: true });
notificationSchema.index({ user: 1, workspace: 1, createdAt: -1 });
export const Notification = mongoose.model('Notification', notificationSchema);
