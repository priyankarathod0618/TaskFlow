import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : null;

    if (!token) {
      return res.status(401).json({ message: 'Please sign in to continue.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });
    if (typeof payload.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({ message: 'Invalid session. Please sign in again.' });
    }

    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user) return res.status(401).json({ message: 'Account no longer exists.' });

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'CastError') {
      return res.status(401).json({ message: 'Your session is invalid or expired. Please sign in again.' });
    }
    return next(error);
  }
}
