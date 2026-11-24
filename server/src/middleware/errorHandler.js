import mongoose from 'mongoose';
import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Request validation failed.',
      errors: err.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    });
  }

  let status = Number(err.statusCode || err.status || 500);
  if (!Number.isInteger(status) || status < 400 || status > 599) status = 500;
  let message = 'Something went wrong on the server.';

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'The submitted data is invalid.';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = 'A supplied identifier or value is invalid.';
  } else if (err.code === 11000) {
    status = 409;
    message = 'A record with these details already exists.';
  } else if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    status = 400;
    message = 'Request body contains invalid JSON.';
  } else if (status < 500 && err.message) {
    message = err.message;
  }

  if (status >= 500) {
    console.error('Unhandled API error:', {
      method: req.method,
      path: req.path,
      name: err.name || 'Error',
      message: err.message || 'Unknown error'
    });
  }

  return res.status(status).json({ message });
}
