
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { createNotifications } from '../services/notificationService.js';
import { requireText, isObjectId } from '../utils/validation.js';

async function notifyProjectMembers({
  workspace,
  actorId,
  message
}) {
  const memberIds = (workspace.members || [])
    .map(member => member.user || member)
    .filter(Boolean);

  return createNotifications({
    userIds: memberIds,
    workspaceId: workspace._id,
    message,
    link: '/projects',
    excludeUserIds: [actorId]
  });
}

export async function listProjects(req, res) {
  const projects = await Project.find({
    workspace: req.workspace._id,
    status: { $ne: 'Archived' }
  })
    .populate('owner', 'name email')
    .sort({ updatedAt: -1 })
    .limit(200);

  const ids = projects.map(project => project._id);

  const counts = ids.length
    ? await Task.aggregate([
        {
          $match: {
            workspace: req.workspace._id,
            project: { $in: ids }
          }
        },
        {
          $group: {
            _id: '$project',
            total: { $sum: 1 },
            done: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'Done'] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])
    : [];

  const map = new Map(
    counts.map(item => [String(item._id), item])
  );

  res.json({
    projects: projects.map(project => ({
      ...project.toObject(),
      taskStats: map.get(String(project._id)) || {
        total: 0,
        done: 0
      }
    }))
  });
}

export async function createProject(req, res) {
  const body = req.body || {};

  const name = requireText(
    body.name,
    'Project name',
    { min: 1, max: 120 }
  );

  const allowed = [
    'description',
    'priority',
    'dueDate',
    'startDate',
    'color',
    'status',
    'code'
  ];

  const data = Object.fromEntries(
    Object.entries(body).filter(([key]) =>
      allowed.includes(key)
    )
  );

  const project = await Project.create({
    ...data,
    name,
    workspace: req.workspace._id,
    owner: req.user._id
  });

  await notifyProjectMembers({
    workspace: req.workspace,
    actorId: req.user._id,
    message: `New project created: ${project.name}`
  });

  res.status(201).json({ project });
}

export async function updateProject(req, res) {
  const allowed = [
    'name',
    'description',
    'priority',
    'status',
    'dueDate',
    'startDate',
    'color',
    'code'
  ];

  const patch = Object.fromEntries(
    Object.entries(req.body || {}).filter(([key]) =>
      allowed.includes(key)
    )
  );

  if (!Object.keys(patch).length) {
    return res.status(400).json({
      message: 'No editable project fields were provided.'
    });
  }

  if (Object.hasOwn(patch, 'name')) {
    patch.name = requireText(
      patch.name,
      'Project name',
      { min: 1, max: 120 }
    );
  }

  if (
    Object.hasOwn(patch, 'code') &&
    patch.code !== null
  ) {
    patch.code = requireText(
      patch.code,
      'Project code',
      { min: 1, max: 20 }
    ).toUpperCase();
  }

  const project = await Project.findOneAndUpdate(
    {
      _id: req.params.id,
      workspace: req.workspace._id
    },
    { $set: patch },
    {
      new: true,
      runValidators: true
    }
  );

  if (!project) {
    return res.status(404).json({
      message: 'Project not found.'
    });
  }

  await notifyProjectMembers({
    workspace: req.workspace,
    actorId: req.user._id,
    message: `Project updated: ${project.name}`
  });

  res.json({ project });
}

export async function archiveProject(req, res) {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({
      message: 'Invalid project ID.'
    });
  }

  const project = await Project.findOneAndUpdate(
    {
      _id: req.params.id,
      workspace: req.workspace._id
    },
    {
      $set: {
        status: 'Archived',
        archivedAt: new Date()
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!project) {
    return res.status(404).json({
      message: 'Project not found.'
    });
  }

  await notifyProjectMembers({
    workspace: req.workspace,
    actorId: req.user._id,
    message: `Project archived: ${project.name}`
  });

  res.json({ project });
}
