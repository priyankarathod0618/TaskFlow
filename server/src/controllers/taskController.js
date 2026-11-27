
import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { createNotifications } from '../services/notificationService.js';
import { canEditWorkspaceRecord } from '../utils/workspacePermissions.js';

import {
  getWorkspaceMember,
  isObjectId,
  requireText,
  badRequest,
  escapeRegex
} from '../utils/validation.js';

const TASK_STATUSES = [
  'Backlog',
  'To do',
  'In progress',
  'In review',
  'Done'
];

const TASK_PRIORITIES = [
  'Low',
  'Medium',
  'High',
  'Urgent'
];

const populate = (query) => query
  .populate('assignee', 'name email')
  .populate('reporter', 'name email')
  .populate('comments.author', 'name')
  .populate('parentTask', 'title status')
  .populate('dependencies', 'title status');

async function notifyTaskParticipants({
  task,
  workspace,
  actorId,
  message,
  body = ''
}) {
  const recipients = new Set();

  for (const id of [task.assignee, task.reporter]) {
    if (id && String(id) !== String(actorId)) {
      recipients.add(String(id));
    }
  }

  const mentions = [
    ...String(body).matchAll(
      /@([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi
    )
  ].map((match) => match[1].toLowerCase());

  if (mentions.length) {
    const workspaceMemberIds = (workspace.members || [])
      .map((member) => member.user);

    const mentionedUsers = await User.find({
      email: { $in: mentions },
      _id: { $in: workspaceMemberIds }
    }).select('_id');

    for (const user of mentionedUsers) {
      if (String(user._id) !== String(actorId)) {
        recipients.add(String(user._id));
      }
    }
  }

  if (!recipients.size) return [];

  return createNotifications({
    userIds: [...recipients],
    workspaceId: workspace._id,
    message,
    link: '/tasks',
    excludeUserIds: [actorId]
  });
}

async function notifyTaskAssignee({
  assigneeId,
  workspaceId,
  actorId,
  message
}) {
  if (!assigneeId || String(assigneeId) === String(actorId)) {
    return [];
  }

  return createNotifications({
    userIds: [assigneeId],
    workspaceId,
    message,
    link: '/tasks',
    excludeUserIds: [actorId]
  });
}

async function validateMember(workspace, userId, field = 'Assignee') {
  if (userId === null || userId === '') return null;

  if (!isObjectId(userId) || !getWorkspaceMember(workspace, userId)) {
    throw badRequest(
      `${field} must be an active member of this workspace.`
    );
  }

  return userId;
}

function validateTaskWorkflow({ status, priority }) {
  if (
    status !== undefined &&
    !TASK_STATUSES.includes(status)
  ) {
    throw badRequest(
      `Status must be one of: ${TASK_STATUSES.join(', ')}.`
    );
  }

  if (
    priority !== undefined &&
    !TASK_PRIORITIES.includes(priority)
  ) {
    throw badRequest(
      `Priority must be one of: ${TASK_PRIORITIES.join(', ')}.`
    );
  }
}

function validateTaskDates({ startDate, dueDate }) {
  function parseDate(value, field) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw badRequest(`${field} must be a valid date.`);
    }

    if (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      const [year, month, day] = value.split('-').map(Number);
      const check = new Date(Date.UTC(year, month - 1, day));

      if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
      ) {
        throw badRequest(
          `${field} must be a valid calendar date.`
        );
      }
    }

    return date;
  }

  const start = parseDate(startDate, 'Start date');
  const due = parseDate(dueDate, 'Due date');

  if (start && due && start > due) {
    throw badRequest(
      'Start date cannot be later than the due date.'
    );
  }
}

async function validateTaskRelations({
  workspace,
  project,
  parentTask,
  dependencies,
  currentTaskId
}) {
  if (parentTask) {
    if (
      !isObjectId(parentTask) ||
      String(parentTask) === String(currentTaskId)
    ) {
      throw badRequest(
        'Parent task must be a valid different task.'
      );
    }

    let currentParentId = String(parentTask);
    const visited = new Set();

    while (currentParentId) {
      if (currentParentId === String(currentTaskId)) {
        throw badRequest(
          'This parent task would create a circular parent/subtask relationship.'
        );
      }

      if (visited.has(currentParentId)) {
        throw badRequest(
          'An existing circular parent-task relationship was detected.'
        );
      }

      visited.add(currentParentId);

      if (visited.size > 1000) {
        throw badRequest(
          'Parent-task hierarchy is too large to validate safely.'
        );
      }

      const parent = await Task.findOne({
        _id: currentParentId,
        workspace: workspace._id,
        project
      }).select('_id parentTask');

      if (!parent) {
        throw badRequest(
          'Parent task must belong to the same project and workspace.'
        );
      }

      currentParentId = parent.parentTask
        ? String(parent.parentTask)
        : null;
    }
  }

  if (dependencies !== undefined) {
    if (
      !Array.isArray(dependencies) ||
      dependencies.length > 100
    ) {
      throw badRequest(
        'Dependencies must be an array containing at most 100 task IDs.'
      );
    }

    const ids = [...new Set(dependencies.map(String))];

    if (
      ids.some(id => !isObjectId(id)) ||
      ids.some(id => id === String(currentTaskId))
    ) {
      throw badRequest(
        'Dependencies must contain valid task IDs and cannot include this task.'
      );
    }

    const found = ids.length
      ? await Task.countDocuments({
          _id: { $in: ids },
          workspace: workspace._id,
          project
        })
      : 0;

    if (found !== ids.length) {
      throw badRequest(
        'Every dependency must belong to the same project and workspace.'
      );
    }

    return ids;
  }

  return dependencies;
}

async function createsDependencyCycle(
  workspaceId,
  taskId,
  dependencyIds
) {
  const visited = new Set();
  const queue = [...dependencyIds].map(String);

  while (queue.length) {
    const id = queue.shift();

    if (id === String(taskId)) return true;
    if (visited.has(id)) continue;

    visited.add(id);

    if (visited.size > 1000) {
      throw badRequest(
        'Dependency graph is too large to validate safely.'
      );
    }

    const node = await Task.findOne({
      _id: id,
      workspace: workspaceId
    }).select('dependencies');

    if (node) {
      queue.push(...node.dependencies.map(String));
    }
  }

  return false;
}

export async function listTasks(req, res) {
  const filter = {
    workspace: req.workspace._id
  };

  if (req.query.project) {
    if (!isObjectId(req.query.project)) {
      return res.status(400).json({
        message: 'Invalid project ID.'
      });
    }

    filter.project = req.query.project;
  }

  if (req.query.status) {
    if (!TASK_STATUSES.includes(req.query.status)) {
      return res.status(400).json({
        message: `Status must be one of: ${TASK_STATUSES.join(', ')}.`
      });
    }

    filter.status = req.query.status;
  }

  if (req.query.search) {
    const search = String(req.query.search).slice(0, 100);

    filter.title = {
      $regex: escapeRegex(search),
      $options: 'i'
    };
  }

  const tasks = await populate(
    Task.find(filter).sort({ updatedAt: -1 }).limit(200)
  );

  res.json({ tasks });
}

export async function createTask(req, res) {
  const body = req.body || {};

  if (!isObjectId(body.project)) {
    return res.status(400).json({
      message: 'A valid project is required.'
    });
  }

  const project = await Project.findOne({
    _id: body.project,
    workspace: req.workspace._id
  }).select('_id');

  if (!project) {
    return res.status(404).json({
      message: 'Project not found.'
    });
  }

  const title = requireText(body.title, 'Task title', {
    min: 1,
    max: 200
  });

  const allowed = [
    'description',
    'status',
    'priority',
    'assignee',
    'dueDate',
    'startDate',
    'labels',
    'estimateHours',
    'parentTask',
    'dependencies'
  ];

  const data = Object.fromEntries(
    Object.entries(body).filter(([key]) =>
      allowed.includes(key)
    )
  );

  validateTaskWorkflow({
    status: data.status,
    priority: data.priority
  });

  validateTaskDates({
    startDate: data.startDate,
    dueDate: data.dueDate
  });

  if (Object.hasOwn(data, 'assignee')) {
    data.assignee = await validateMember(
      req.workspace,
      data.assignee
    );
  }

  if (
    Object.hasOwn(data, 'parentTask') ||
    Object.hasOwn(data, 'dependencies')
  ) {
    const dependencies = await validateTaskRelations({
      workspace: req.workspace,
      project: project._id,
      parentTask: data.parentTask,
      dependencies: data.dependencies
    });

    if (dependencies !== undefined) {
      data.dependencies = dependencies;
    }
  }

  if (
    data.labels !== undefined &&
    (
      !Array.isArray(data.labels) ||
      data.labels.length > 30 ||
      data.labels.some(v =>
        typeof v !== 'string' || v.length > 40
      )
    )
  ) {
    return res.status(400).json({
      message: 'Labels must be an array of at most 30 strings, each no longer than 40 characters.'
    });
  }

  if (
    data.estimateHours !== undefined &&
    (
      !Number.isFinite(Number(data.estimateHours)) ||
      Number(data.estimateHours) < 0 ||
      Number(data.estimateHours) > 100000
    )
  ) {
    return res.status(400).json({
      message: 'Estimate hours must be a non-negative number.'
    });
  }

  const task = await Task.create({
    ...data,
    title,
    project: project._id,
    workspace: req.workspace._id,
    reporter: req.user._id,
    activity: [
      {
        actor: req.user._id,
        action: 'created',
        detail: 'created this task'
      }
    ]
  });

  await notifyTaskAssignee({
    assigneeId: task.assignee,
    workspaceId: req.workspace._id,
    actorId: req.user._id,
    message: `You were assigned: ${task.title}`
  });

  res.status(201).json({
    task: await populate(Task.findById(task._id))
  });
}

export async function updateTask(req, res) {
  const task = await Task.findOne({
    _id: req.params.id,
    workspace: req.workspace._id
  });

  if (!task) {
    return res.status(404).json({
      message: 'Task not found.'
    });
  }

  if (!canEditWorkspaceRecord(req.workspaceRole, req.user._id, task)) {
    return res.status(403).json({
      message: 'You can edit tasks only when you are a workspace manager, the task reporter, or its assignee.'
    });
  }

  const allowed = [
    'title',
    'description',
    'status',
    'priority',
    'assignee',
    'dueDate',
    'startDate',
    'labels',
    'estimateHours',
    'parentTask',
    'dependencies'
  ];

  const patch = Object.fromEntries(
    Object.entries(req.body || {}).filter(([key]) =>
      allowed.includes(key)
    )
  );

  if (!Object.keys(patch).length) {
    return res.status(400).json({
      message: 'No editable task fields were provided.'
    });
  }

  validateTaskWorkflow({
    status: patch.status,
    priority: patch.priority
  });

  validateTaskDates({
    startDate: Object.hasOwn(patch, 'startDate')
      ? patch.startDate
      : task.startDate,
    dueDate: Object.hasOwn(patch, 'dueDate')
      ? patch.dueDate
      : task.dueDate
  });

  if (Object.hasOwn(patch, 'title')) {
    patch.title = requireText(patch.title, 'Task title', {
      min: 1,
      max: 200
    });
  }

  if (Object.hasOwn(patch, 'assignee')) {
    patch.assignee = await validateMember(
      req.workspace,
      patch.assignee
    );
  }

  if (
    Object.hasOwn(patch, 'labels') &&
    (
      !Array.isArray(patch.labels) ||
      patch.labels.length > 30 ||
      patch.labels.some(v =>
        typeof v !== 'string' || v.length > 40
      )
    )
  ) {
    return res.status(400).json({
      message: 'Labels must be an array of at most 30 strings, each no longer than 40 characters.'
    });
  }

  if (
    Object.hasOwn(patch, 'estimateHours') &&
    (
      !Number.isFinite(Number(patch.estimateHours)) ||
      Number(patch.estimateHours) < 0 ||
      Number(patch.estimateHours) > 100000
    )
  ) {
    return res.status(400).json({
      message: 'Estimate hours must be a non-negative number.'
    });
  }

  if (
    Object.hasOwn(patch, 'parentTask') ||
    Object.hasOwn(patch, 'dependencies')
  ) {
    const dependencies = await validateTaskRelations({
      workspace: req.workspace,
      project: task.project,
      parentTask: Object.hasOwn(patch, 'parentTask')
        ? patch.parentTask
        : task.parentTask,
      dependencies: Object.hasOwn(patch, 'dependencies')
        ? patch.dependencies
        : undefined,
      currentTaskId: task._id
    });

    if (Object.hasOwn(patch, 'dependencies')) {
      if (
        await createsDependencyCycle(
          req.workspace._id,
          task._id,
          dependencies
        )
      ) {
        return res.status(400).json({
          message: 'These dependencies would create a circular task dependency.'
        });
      }

      patch.dependencies = dependencies;
    }
  }

  const effectiveDependencies = Object.hasOwn(patch, 'dependencies')
    ? patch.dependencies
    : task.dependencies;

  if (
    patch.status === 'Done' &&
    effectiveDependencies?.length
  ) {
    const incompleteDependencies = await Task.find({
      _id: { $in: effectiveDependencies },
      workspace: req.workspace._id,
      project: task.project,
      status: { $ne: 'Done' }
    }).select('title status');

    if (incompleteDependencies.length) {
      return res.status(400).json({
        message: `Cannot complete this task until its dependencies are done: ${incompleteDependencies
          .map(dep => dep.title)
          .join(', ')}.`
      });
    }
  }

  const previousAssignee = task.assignee
    ? String(task.assignee)
    : null;

  const previousStatus = task.status;

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'status' && value !== task.status) {
      task.activity.push({
        actor: req.user._id,
        action: 'moved',
        detail: `moved from ${task.status} to ${value}`
      });
    }

    task[key] = value;
  }

  await task.save();

  if (
    patch.status !== undefined &&
    patch.status !== previousStatus
  ) {
    await notifyTaskParticipants({
      task,
      workspace: req.workspace,
      actorId: req.user._id,
      message: `Task update: ${task.title} is now ${task.status}.`
    });
  }

  if (
    task.assignee &&
    String(task.assignee) !== previousAssignee
  ) {
    await notifyTaskAssignee({
      assigneeId: task.assignee,
      workspaceId: req.workspace._id,
      actorId: req.user._id,
      message: `You were assigned: ${task.title}`
    });
  }

  res.json({
    task: await populate(Task.findById(task._id))
  });
}

export async function addComment(req, res) {
  const body = requireText(req.body?.body, 'Comment', {
    min: 1,
    max: 5000
  });

  const task = await Task.findOne({
    _id: req.params.id,
    workspace: req.workspace._id
  });

  if (!task) {
    return res.status(404).json({
      message: 'Task not found.'
    });
  }

  task.comments.push({
    author: req.user._id,
    body
  });

  task.activity.push({
    actor: req.user._id,
    action: 'commented',
    detail: 'added a comment'
  });

  await task.save();

  await notifyTaskParticipants({
    task,
    workspace: req.workspace,
    actorId: req.user._id,
    message: `New discussion on: ${task.title}`,
    body
  });

  res.status(201).json({
    task: await populate(Task.findById(task._id))
  });
}

export async function deleteTask(req, res) {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({
      message: 'Invalid task ID.'
    });
  }

  const task = await Task.findOne({
    _id: req.params.id,
    workspace: req.workspace._id
  });

  if (!task) {
    return res.status(404).json({
      message: 'Task not found.'
    });
  }

  const relatedTasks = await Task.find({
    workspace: req.workspace._id,
    _id: { $ne: task._id },
    $or: [
      { parentTask: task._id },
      { dependencies: task._id }
    ]
  }).select('title parentTask dependencies');

  if (relatedTasks.length > 0) {
    return res.status(409).json({
      message: `Cannot delete this task because ${relatedTasks.length} other task(s) reference it. Remove their parent-task or dependency relationships first.`,
      relatedTasks: relatedTasks.map(item => ({
        id: item._id,
        title: item.title
      }))
    });
  }

  await task.deleteOne();

  return res.json({
    message: 'Task deleted successfully.',
    taskId: task._id
  });
}
