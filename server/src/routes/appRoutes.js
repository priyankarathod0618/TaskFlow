
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  attachWorkspace,
  requireWorkspaceRole
} from '../middleware/workspace.js';
import { asyncHandler } from '../utils/asyncHandler.js';

import * as projects from '../controllers/projectController.js';
import * as tasks from '../controllers/taskController.js';
import * as resources from '../controllers/resourceController.js';
import * as timesheets from '../controllers/timesheetController.js';
import * as collaboration from '../controllers/collaborationController.js';
import * as reports from '../controllers/reportsController.js';

import { WORKSPACE_ROLE_GROUPS } from '../utils/workspacePermissions.js';

const router = Router();

const managers = requireWorkspaceRole(
  ...WORKSPACE_ROLE_GROUPS.managers
);

const contributors = requireWorkspaceRole(
  ...WORKSPACE_ROLE_GROUPS.contributors
);

router.use(requireAuth, attachWorkspace);

router.get('/dashboard', asyncHandler(resources.dashboard));
router.get('/activity', asyncHandler(resources.listActivity));

// Collaboration
router.get(
  '/collaboration/messages',
  asyncHandler(collaboration.listMessages)
);

router.post(
  '/collaboration/messages',
  contributors,
  asyncHandler(collaboration.createMessage)
);

// Reports
router.get('/reports', asyncHandler(reports.reports));

router.get(
  '/analytics/workload',
  asyncHandler(resources.workloadAnalytics)
);

// Projects
router.get('/projects', asyncHandler(projects.listProjects));
router.post('/projects', managers, asyncHandler(projects.createProject));
router.patch('/projects/:id', managers, asyncHandler(projects.updateProject));
router.post('/projects/:id/archive', managers, asyncHandler(projects.archiveProject));

// Tasks
router.get('/tasks', asyncHandler(tasks.listTasks));
router.post('/tasks', contributors, asyncHandler(tasks.createTask));
router.patch('/tasks/:id', contributors, asyncHandler(tasks.updateTask));
router.delete('/tasks/:id', managers, asyncHandler(tasks.deleteTask));

router.post(
  '/tasks/:id/comments',
  contributors,
  asyncHandler(tasks.addComment)
);

// Issues
router.get('/issues', asyncHandler(resources.listIssues));
router.post('/issues', contributors, asyncHandler(resources.createIssue));
router.patch('/issues/:id', contributors, asyncHandler(resources.updateIssue));

// Milestones
router.get('/milestones', asyncHandler(resources.listMilestones));

router.post(
  '/milestones',
  managers,
  asyncHandler(resources.createMilestone)
);

router.patch(
  '/milestones/:id',
  managers,
  asyncHandler(resources.updateMilestone)
);

// Time entries
router.get('/time-entries', asyncHandler(resources.listTime));

router.post(
  '/time-entries',
  contributors,
  asyncHandler(resources.createTime)
);

// Timesheets
router.get('/timesheets', asyncHandler(timesheets.listTimesheets));

router.post(
  '/timesheets/submit',
  contributors,
  asyncHandler(timesheets.submitTimesheet)
);

router.patch(
  '/timesheets/:id/review',
  managers,
  asyncHandler(timesheets.reviewTimesheet)
);

// Members
router.get('/members', asyncHandler(resources.listMembers));

// Notifications
router.get(
  '/notifications',
  asyncHandler(resources.listNotifications)
);

router.patch(
  '/notifications/read-all',
  asyncHandler(resources.readAllNotifications)
);

router.patch(
  '/notifications/:id/read',
  asyncHandler(resources.readNotification)
);

export default router;
