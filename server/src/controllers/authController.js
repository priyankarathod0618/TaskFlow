import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { ensureWorkspace } from '../services/workspaceService.js';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(100)
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(100)
});

function issue(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '7d'
  });
}

export async function register(req, res) {
  const input = registerSchema.parse(req.body || {});
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email }).select('_id');
  if (existing) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  try {
    const user = await User.create({
      name: input.name,
      email,
      passwordHash: await bcrypt.hash(input.password, 12)
    });
    await ensureWorkspace(user);
    res.status(201).json({
      token: issue(user),
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    throw error;
  }
}

export async function login(req, res) {
  const input = loginSchema.parse(req.body || {});
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    return res.status(401).json({ message: 'Email or password is incorrect.' });
  }
  await ensureWorkspace(user);
  res.json({
    token: issue(user),
    user: { id: user._id, name: user.name, email: user.email }
  });
}

export async function me(req, res) {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      title: req.user.title
    }
  });
}
