import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  avatarColor: { type: String, default: '#5b6ee1' },
  title: { type: String, default: 'Workspace member', maxlength: 100 }
}, { timestamps: true });
export const User = mongoose.model('User', userSchema);
