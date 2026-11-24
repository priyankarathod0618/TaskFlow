# TaskFlow Pro — Security Update

## Included changes

### Authorization
- Added route-level workspace role guards.
- Owner/admin: create, update and archive projects; create/update milestones; review timesheets.
- Owner/admin/member: create/update tasks and issues, comment on tasks, create time entries and submit timesheets.
- All active workspace roles can read workspace data; time-entry and timesheet listings remain restricted to the signed-in member unless the role is owner/admin.
- Requests from users who are not active members of the attached workspace are rejected.

### Data isolation and validation
- Task, issue, milestone and time-entry creation now use explicit accepted fields.
- Project references are checked against the active workspace.
- Task assignees must be active workspace members.
- Parent tasks and dependencies must belong to the same project and workspace; direct self-dependencies and detected dependency cycles are rejected.
- Time entries validate project/task consistency, date, hours and billable flag.
- Notification reads are scoped to the current user and workspace.
- Search terms are escaped before being used in a regular expression.
- List endpoints use bounded result limits.
- Approved/submitted timesheets lock additional time-entry creation for that week.
- Timesheet reviews use a conditional update to prevent two reviewers from both changing the same submitted record.

### Runtime and account hardening
- Password hashes are excluded from normal User queries and explicitly selected only for login.
- JWT subject IDs are validated before database lookup; HS256 remains enforced.
- Production CORS origins are validated as exact HTTP(S) origins.
- Removed the process-wide DNS server override.
- Production request logs omit query strings.
- Error responses avoid leaking database field names or internal 500 details.
- Added bounded graceful-shutdown behavior.

### Database indexes
Run `npm run ensure:indexes` from the `server` folder after taking a database backup. This explicitly creates/ensures schema indexes even when automatic index creation is disabled in production. The unique timesheet index can fail if existing data already contains duplicate workspace/user/week records; resolve those duplicates before retrying.

### Automated checks
Run `npm test` from the `server` folder. The included tests cover input helper behavior, literal search escaping, ObjectId validation, workspace membership lookup and role-guard allow/deny behavior.

## Before deploying
1. Create a database backup.
2. Install dependencies with `npm install` in `server` and `client`.
3. Run `npm test` in `server`.
4. Run `npm run ensure:indexes` in `server`.
5. Start the backend and frontend locally.
6. Test owner/admin/member/viewer actions using separate accounts.
7. Test cross-workspace project/task IDs and confirm the API rejects them.
8. Confirm the existing UI workflows still work.
9. Set production environment variables and verify the deployed proxy/CORS configuration.

## Not included / not yet verified
- This update does not implement multiple workspace creation/switching, member invitations, invitation acceptance or member administration APIs.
- It does not add email verification, password reset delivery, real-time chat, or full audit/event infrastructure.
- Automated tests are currently focused utility/authorization tests, not a complete MongoDB-backed API integration suite.
- Production deployment, MongoDB index migration and full end-to-end behavior must still be tested in the user's environment. Do not treat this ZIP as production-certified.
