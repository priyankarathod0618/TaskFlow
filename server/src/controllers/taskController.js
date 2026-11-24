import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { getWorkspaceMember, isObjectId, requireText, badRequest, escapeRegex } from '../utils/validation.js';

const populate = (query) => query
  .populate('assignee', 'name email')
  .populate('reporter', 'name email')
  .populate('comments.author', 'name');

async function notifyTaskParticipants({ task, workspace, actorId, message, body = '' }) {
  const recipients = new Set();
  for (const id of [task.assignee, task.reporter]) if (id && String(id) !== String(actorId)) recipients.add(String(id));
  const mentions = [...String(body).matchAll(/@([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi)].map((m) => m[1].toLowerCase());
  if (mentions.length) {
    const mentionedUsers = await User.find({ email: { $in: mentions }, _id: { $in: workspace.members.map((m) => m.user) } }).select('_id');
    for (const user of mentionedUsers) if (String(user._id) !== String(actorId)) recipients.add(String(user._id));
  }
  if (recipients.size) await Notification.insertMany([...recipients].map((user) => ({ user, workspace: workspace._id, message, link: '/tasks' })));
}

async function validateMember(workspace, userId, field = 'Assignee') {
  if (userId === null || userId === '') return null;
  if (!isObjectId(userId) || !getWorkspaceMember(workspace, userId)) {
    throw badRequest(`${field} must be an active member of this workspace.`);
  }
  return userId;
}

async function validateTaskRelations({ workspace, project, parentTask, dependencies, currentTaskId }) {
  if (parentTask) {
    if (!isObjectId(parentTask) || String(parentTask) === String(currentTaskId)) {
      throw badRequest('Parent task must be a valid different task.');
    }
    const parent = await Task.findOne({
      _id: parentTask, workspace: workspace._id, project
    }).select('_id');
    if (!parent) throw badRequest('Parent task must belong to the same project and workspace.');
  }

  if (dependencies !== undefined) {
    if (!Array.isArray(dependencies) || dependencies.length > 100) {
      throw badRequest('Dependencies must be an array containing at most 100 task IDs.');
    }
    const ids = [...new Set(dependencies.map(String))];
    if (ids.some((id) => !isObjectId(id)) || ids.some((id) => id === String(currentTaskId))) {
      throw badRequest('Dependencies must contain valid task IDs and cannot include this task.');
    }
    const found = ids.length
      ? await Task.countDocuments({ _id: { $in: ids }, workspace: workspace._id, project })
      : 0;
    if (found !== ids.length) {
      throw badRequest('Every dependency must belong to the same project and workspace.');
    }
    return ids;
  }
  return dependencies;
}

async function createsDependencyCycle(workspaceId, taskId, dependencyIds) {
  const visited = new Set();
  const queue = [...dependencyIds].map(String);
  while (queue.length) {
    const id = queue.shift();
    if (id === String(taskId)) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    if (visited.size > 1000) throw badRequest('Dependency graph is too large to validate safely.');
    const node = await Task.findOne({ _id: id, workspace: workspaceId }).select('dependencies');
    if (node) queue.push(...node.dependencies.map(String));
  }
  return false;
}

export async function listTasks(req, res) {
  const filter = { workspace: req.workspace._id };
  if (req.query.project) {
    if (!isObjectId(req.query.project)) return res.status(400).json({ message: 'Invalid project ID.' });
    filter.project = req.query.project;
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const search = String(req.query.search).slice(0, 100);
    filter.title = { $regex: escapeRegex(search), $options: 'i' };
  }
  const tasks = await populate(Task.find(filter).sort({ updatedAt: -1 }).limit(200));
  res.json({ tasks });
}

export async function createTask(req, res) {
  const body = req.body || {};
  if (!isObjectId(body.project)) return res.status(400).json({ message: 'A valid project is required.' });
  const project = await Project.findOne({ _id: body.project, workspace: req.workspace._id }).select('_id');
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  const title = requireText(body.title, 'Task title', { min: 1, max: 200 });
  const allowed = ['description', 'status', 'priority', 'assignee', 'dueDate', 'startDate', 'labels', 'estimateHours', 'parentTask', 'dependencies'];
  const data = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
  if (Object.hasOwn(data, 'assignee')) data.assignee = await validateMember(req.workspace, data.assignee);
  if (Object.hasOwn(data, 'parentTask') || Object.hasOwn(data, 'dependencies')) {
    const dependencies = await validateTaskRelations({
      workspace: req.workspace,
      project: project._id,
      parentTask: data.parentTask,
      dependencies: data.dependencies
    });
    if (dependencies !== undefined) data.dependencies = dependencies;
  }
  if (data.labels !== undefined && (!Array.isArray(data.labels) || data.labels.length > 30 || data.labels.some((v) => typeof v !== 'string' || v.length > 40))) {
    return res.status(400).json({ message: 'Labels must be an array of at most 30 strings, each no longer than 40 characters.' });
  }
  if (data.estimateHours !== undefined && (!Number.isFinite(Number(data.estimateHours)) || Number(data.estimateHours) < 0 || Number(data.estimateHours) > 100000)) {
    return res.status(400).json({ message: 'Estimate hours must be a non-negative number.' });
  }

  const task = await Task.create({
    ...data,
    title,
    project: project._id,
    workspace: req.workspace._id,
    reporter: req.user._id,
    activity: [{ actor: req.user._id, action: 'created', detail: 'created this task' }]
  });
  if (task.assignee) {
    await Notification.create({
      user: task.assignee, workspace: req.workspace._id,
      message: `You were assigned: ${task.title}`, link: '/tasks'
    });
  }
  res.status(201).json({ task: await populate(Task.findById(task._id)) });
}

export async function updateTask(req, res) {
  const task = await Task.findOne({ _id: req.params.id, workspace: req.workspace._id });
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  if (req.workspaceRole === 'member' && String(task.assignee || '') !== String(req.user._id) && String(task.reporter || '') !== String(req.user._id)) {
    return res.status(403).json({ message: 'Members can edit tasks assigned to them or created by them. Ask a workspace admin for broader access.' });
  }

  const allowed = ['title', 'description', 'status', 'priority', 'assignee', 'dueDate', 'startDate', 'labels', 'estimateHours', 'parentTask', 'dependencies'];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if (!Object.keys(patch).length) return res.status(400).json({ message: 'No editable task fields were provided.' });

  if (Object.hasOwn(patch, 'title')) patch.title = requireText(patch.title, 'Task title', { min: 1, max: 200 });
  if (Object.hasOwn(patch, 'assignee')) patch.assignee = await validateMember(req.workspace, patch.assignee);
  if (Object.hasOwn(patch, 'labels') && (!Array.isArray(patch.labels) || patch.labels.length > 30 || patch.labels.some((v) => typeof v !== 'string' || v.length > 40))) {
    return res.status(400).json({ message: 'Labels must be an array of at most 30 strings, each no longer than 40 characters.' });
  }
  if (Object.hasOwn(patch, 'estimateHours') && (!Number.isFinite(Number(patch.estimateHours)) || Number(patch.estimateHours) < 0 || Number(patch.estimateHours) > 100000)) {
    return res.status(400).json({ message: 'Estimate hours must be a non-negative number.' });
  }
  if (Object.hasOwn(patch, 'parentTask') || Object.hasOwn(patch, 'dependencies')) {
    const dependencies = await validateTaskRelations({
      workspace: req.workspace,
      project: task.project,
      parentTask: Object.hasOwn(patch, 'parentTask') ? patch.parentTask : task.parentTask,
      dependencies: Object.hasOwn(patch, 'dependencies') ? patch.dependencies : undefined,
      currentTaskId: task._id
    });
    if (Object.hasOwn(patch, 'dependencies')) {
      if (await createsDependencyCycle(req.workspace._id, task._id, dependencies)) {
        return res.status(400).json({ message: 'These dependencies would create a circular task dependency.' });
      }
      patch.dependencies = dependencies;
    }
  }

  const previousAssignee = task.assignee ? String(task.assignee) : null;
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'status' && value !== task.status) {
      task.activity.push({ actor: req.user._id, action: 'moved', detail: `moved from ${task.status} to ${value}` });
    }
    task[key] = value;
  }
  await task.save();

  if (patch.status && patch.status !== undefined) {
    await notifyTaskParticipants({ task, workspace: req.workspace, actorId: req.user._id, message: `Task update: ${task.title} is now ${task.status}.` });
  }
  if (task.assignee && String(task.assignee) !== previousAssignee) {
    await Notification.create({
      user: task.assignee, workspace: req.workspace._id,
      message: `You were assigned: ${task.title}`, link: '/tasks'
    });
  }
  res.json({ task: await populate(Task.findById(task._id)) });
}

export async function addComment(req, res) {
  const body = requireText(req.body?.body, 'Comment', { min: 1, max: 5000 });
  const task = await Task.findOne({ _id: req.params.id, workspace: req.workspace._id });
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  task.comments.push({ author: req.user._id, body });
  task.activity.push({ actor: req.user._id, action: 'commented', detail: 'added a comment' });
  await task.save();
  await notifyTaskParticipants({ task, workspace: req.workspace, actorId: req.user._id, message: `New discussion on: ${task.title}`, body });
  res.status(201).json({ task: await populate(Task.findById(task._id)) });
}
