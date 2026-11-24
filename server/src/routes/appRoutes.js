import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { attachWorkspace, requireWorkspaceRole } from '../middleware/workspace.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as projects from '../controllers/projectController.js';
import * as tasks from '../controllers/taskController.js';
import * as resources from '../controllers/resourceController.js';
import * as timesheets from '../controllers/timesheetController.js';

const router = Router();
const managers = requireWorkspaceRole('owner', 'admin');
const contributors = requireWorkspaceRole('owner', 'admin', 'member');

router.use(requireAuth, attachWorkspace);

router.get('/dashboard', asyncHandler(resources.dashboard));
router.get('/activity', asyncHandler(resources.listActivity));
router.get('/analytics/workload', asyncHandler(resources.workloadAnalytics));

router.get('/projects', asyncHandler(projects.listProjects));
router.post('/projects', managers, asyncHandler(projects.createProject));
router.patch('/projects/:id', managers, asyncHandler(projects.updateProject));
router.post('/projects/:id/archive', managers, asyncHandler(projects.archiveProject));

router.get('/tasks', asyncHandler(tasks.listTasks));
router.post('/tasks', contributors, asyncHandler(tasks.createTask));
router.patch('/tasks/:id', contributors, asyncHandler(tasks.updateTask));
router.post('/tasks/:id/comments', contributors, asyncHandler(tasks.addComment));

router.get('/issues', asyncHandler(resources.listIssues));
router.post('/issues', contributors, asyncHandler(resources.createIssue));
router.patch('/issues/:id', contributors, asyncHandler(resources.updateIssue));

router.get('/milestones', asyncHandler(resources.listMilestones));
router.post('/milestones', managers, asyncHandler(resources.createMilestone));
router.patch('/milestones/:id', managers, asyncHandler(resources.updateMilestone));

router.get('/time-entries', asyncHandler(resources.listTime));
router.post('/time-entries', contributors, asyncHandler(resources.createTime));

router.get('/timesheets', asyncHandler(timesheets.listTimesheets));
router.post('/timesheets/submit', contributors, asyncHandler(timesheets.submitTimesheet));
router.patch('/timesheets/:id/review', managers, asyncHandler(timesheets.reviewTimesheet));

router.get('/members', asyncHandler(resources.listMembers));
router.get('/notifications', asyncHandler(resources.listNotifications));
router.patch('/notifications/:id/read', asyncHandler(resources.readNotification));

export default router;
