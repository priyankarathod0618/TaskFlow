function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeOrigin(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`CLIENT_URL contains an invalid origin: ${value}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value.replace(/\/$/, '')) {
    throw new Error('CLIENT_URL entries must be exact http(s) origins without paths or query strings.');
  }
  return parsed.origin;
}

export function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const mongoUri = required('MONGODB_URI');
  const jwtSecret = required('JWT_SECRET');

  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters. Generate a new random secret and update server/.env.');
  }

  const clientOrigins = [...new Set((process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin))];

  if (isProduction && clientOrigins.length === 0) {
    throw new Error('CLIENT_URL must contain your deployed frontend origin in production.');
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 5000;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid integer between 1 and 65535.');
  }

  const trustProxy = process.env.TRUST_PROXY === 'true';
  return Object.freeze({
    nodeEnv, isProduction, port, mongoUri, jwtSecret, clientOrigins, trustProxy
  });
}
