# TaskFlow Pro 2.0 — learning build

A modular project-management SaaS learning project built with React, Vite, Express, MongoDB and Mongoose.

## What is included in this upgrade

- Reference-inspired workspace navigation: Home, Reports, Projects, Users, Collaboration, My Approvals, Tasks, Issues, Phases, Time Logs and Timesheets.
- Weekly time-log view with week navigation, daily totals and project/task details.
- Weekly timesheet submission: groups the signed-in user's time entries for a Monday–Sunday week and submits the total for review.
- Timesheet review workflow: workspace owners/admins can approve or reject submitted timesheets with a review note; decisions are persisted with a history trail.
- Workspace-scoped time-entry reads; regular members see only their own entries, while owners/admins can see workspace entries.
- Existing projects, tasks, issues, milestones, notifications and dashboard foundations are retained.

## Honest implementation status

This is an advanced learning build, not a claim of full Zoho Projects parity or production certification. The security update adds role gates to the current API routes, workspace-scoped relationship checks, request-field allowlists, safer time-entry/timesheet handling, and basic automated utility tests. It does not yet implement multiple selectable workspaces, member invitations, email verification, password-reset delivery, real-time collaboration, full automation rules, or Gantt scheduling. The collaboration navigation item remains a UI destination rather than a completed chat/discussion system. Full API integration testing against your MongoDB deployment is still required before production use.

## Requirements

- Node.js 20+
- MongoDB Atlas or local MongoDB

## Setup

### 1. Server

```powershell
cd server
npm install
Copy-Item .env.example .env
```

Fill in `.env` locally. Never commit or upload this file.

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5175
MONGODB_URI=mongodb+srv://<db-user>:<db-password>@<cluster>/<database>
JWT_SECRET=<at-least-32-random-characters>
TRUST_PROXY=false
```

Generate a strong JWT secret in PowerShell with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the generated value into `JWT_SECRET`. Changing this value invalidates existing login tokens. In production, set `NODE_ENV=production`, set `CLIENT_URL` to the exact deployed frontend origin (comma-separated if multiple origins are used), and set `TRUST_PROXY=true` only when the API is behind a trusted reverse proxy. Never commit `.env` or expose secrets in frontend variables.

Start the API:

```powershell
npm run dev
```

Check `http://localhost:5000/api/health` for API liveness and `http://localhost:5000/api/health/readiness` for database readiness.

### 2. Client

Open a second terminal:

```powershell
cd client
npm install
npm run dev
```

Open the Vite URL shown in the terminal (usually `http://localhost:5173`). Development CORS allows localhost ports 5173, 5174 and 5175; `CLIENT_URL` is used for the configured frontend origin and is required in production.

## API additions

- `GET /api/time-entries?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/timesheets` — members see their own; workspace owners/admins see workspace submissions.
- `POST /api/timesheets/submit` with `{ "weekStart": "YYYY-MM-DD" }`
- `PATCH /api/timesheets/:id/review` with `{ "decision": "Approved" | "Rejected", "note": "optional" }` (owner/admin only)

All routes except `/api/health` require a bearer token, except the auth routes.

## Suggested study sequence

1. Trace registration/login: `AuthPage.jsx` → `AuthContext.jsx` → `api.js` → `authRoutes.js` → `authController.js`.
2. Trace workspace boot: `requireAuth` → `attachWorkspace` → `ensureWorkspace`.
3. Trace projects/tasks from React page to route, controller and Mongoose model.
4. Study the time-tracking workflow: `TimeTrackingPages.jsx` → `appRoutes.js` → `timesheetController.js` → `Timesheet.js`.
5. Add tests before expanding the feature set. In particular, test cross-workspace access, member vs admin review permissions, empty weeks, duplicate submission and approved-timesheet resubmission.


## Security update notes

- API roles: owners/admins manage projects and milestones and review timesheets; owners/admins/members create and update tasks and issues, comment, log time and submit timesheets; viewers have read-only access.
- Cross-workspace references are checked for project, task, parent-task, dependency and assignee relationships.
- Task creation, issue creation, milestone creation and time-entry creation accept only explicitly supported fields.
- Time-entry creation is blocked for a week while that user's timesheet is submitted or approved.
- Run `npm test` inside `server` for the included utility tests.
- After taking a database backup, run `npm run ensure:indexes` inside `server` to create/confirm declared MongoDB indexes. This can fail if existing data violates a unique index; inspect and resolve duplicate timesheets before retrying.
- Never include `server/.env` in a ZIP, source-control commit or public upload.
