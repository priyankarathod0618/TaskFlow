import 'dotenv/config';
import http from 'node:http';
import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import { loadConfig } from './config/env.js';
import { connectDatabase } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import appRoutes from './routes/appRoutes.js';
import workspaceRoutes from './routes/workspaceRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

// Local-development workaround for Windows DNS resolvers that reject MongoDB Atlas SRV lookups.
// Production should use the host's configured resolver.
if ((process.env.NODE_ENV || 'development') !== 'production') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const config = loadConfig();
const app = express();

if (config.trustProxy) app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet());

const allowedOrigins = new Set([
  ...config.clientOrigins,
  ...(config.isProduction ? [] : [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175'
  ])
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(Object.assign(new Error('Origin is not allowed by CORS.'), { status: 403 }));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
morgan.token('safe-path', (req) => req.path);
app.use(morgan(':method :safe-path :status :response-time ms', {
  skip: (req) => req.path.startsWith('/api/health')
}));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProduction ? 200 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProduction ? 10 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again later.' }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'TaskFlow Pro API', environment: config.nodeEnv });
});

app.get('/api/health/readiness', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ready' : 'not_ready',
    database: databaseReady ? 'connected' : 'disconnected'
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api', appRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'API route not found.' });
});
app.use(errorHandler);

const server = http.createServer(app);
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Shutting down TaskFlow Pro API...`);

  const forceCloseTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out; closing remaining HTTP connections.');
    server.closeAllConnections?.();
  }, 10000);
  forceCloseTimer.unref();

  server.close(async (serverError) => {
    clearTimeout(forceCloseTimer);
    try {
      await mongoose.disconnect();
      if (serverError) {
        console.error('HTTP server shutdown failed:', serverError.message);
        process.exitCode = 1;
      }
    } catch (databaseError) {
      console.error('Database shutdown failed:', databaseError.message);
      process.exitCode = 1;
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

connectDatabase()
  .then(() => {
    server.listen(config.port, () => {
      console.log(`TaskFlow API running on port ${config.port} (${config.nodeEnv})`);
    });
  })
  .catch((error) => {
    console.error('Application startup failed:', error.message);
    process.exit(1);
  });
