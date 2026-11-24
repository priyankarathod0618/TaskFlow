# TaskFlow Pro deployment checklist

This repository is a learning-grade SaaS application. Complete the checks below before using real customer data. During local development only, the server config uses public DNS resolvers to work around the Windows DNS/SRV lookup failure previously encountered with Atlas. Production leaves the host resolver unchanged.

## Backend (Render, Railway, or another Node host)

- Deploy the `server` directory with Node.js 22.
- Build command: `npm ci`.
- Start command: `npm start`.
- Set `NODE_ENV=production`, `PORT` to the host-provided port, `MONGODB_URI` to a dedicated MongoDB Atlas database, `JWT_SECRET` to a new random value of at least 32 characters, and `CLIENT_URL` to the exact deployed frontend origin.
- Set `TRUST_PROXY=true` only when the provider terminates requests behind a trusted reverse proxy.
- Restrict Atlas Network Access to the provider's outbound IP ranges where possible; avoid `0.0.0.0/0` for production.
- Verify `/api/health` and `/api/health/readiness` after deployment.

## Frontend (Vercel, Netlify, or static hosting)

- Deploy the `client` directory.
- Build command: `npm ci && npm run build`.
- Output directory: `dist`.
- Set `VITE_API_URL` to the deployed API base URL ending in `/api`.
- Add the exact frontend origin to the backend `CLIENT_URL` environment variable and redeploy the backend.

## Before production

- Enable HTTPS and configure a custom domain.
- Back up MongoDB and test restore procedures.
- Review Atlas database users and rotate credentials if exposed.
- Add email delivery for invitations and account recovery; current invitations return a one-time token for manual sharing.
- Add end-to-end tests against a disposable database, dependency scanning, error monitoring and a documented incident process.
- Verify workspace roles using separate owner, admin, member and viewer accounts.
- Do not deploy with `.env`, database credentials, JWT secrets, or real user data in the source archive.
