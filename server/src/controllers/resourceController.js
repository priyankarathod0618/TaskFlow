import { Issue } from '../models/Issue.js';
import { Milestone } from '../models/Milestone.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { Timesheet } from '../models/Timesheet.js';
import { getWorkspaceMember, isObjectId, requireText } from '../utils/validation.js';

function validateAssignee(workspace, value) {
  if (value === null || value === '') return null;
  if (!isObjectId(value) || !getWorkspaceMember(workspace, value)) {
    const error = new Error('Assignee must be an active member of this workspace.');
    error.status = 400;
    throw error;
  }
  return value;
}

export async function listIssues(req, res) {
  const issues = await Issue.find({ workspace: req.workspace._id })
    .populate('assignee', 'name').populate('project', 'name code')
    .sort({ createdAt: -1 }).limit(200);
  res.json({ issues });
}

export async function createIssue(req, res) {
  const body = req.body || {};
  const title = requireText(body.title, 'Issue title', { min: 1, max: 200 });
  if (!isObjectId(body.project)) return res.status(400).json({ message: 'A valid project is required.' });
  const project = await Project.findOne({ _id: body.project, workspace: req.workspace._id }).select('_id');
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  const assignee = Object.hasOwn(body, 'assignee') ? validateAssignee(req.workspace, body.assignee) : undefined;
  const issue = await Issue.create({
    title, description: typeof body.description === 'string' ? body.description.slice(0, 10000) : '',
    severity: body.severity, status: body.status, project: project._id,
    ...(assignee !== undefined ? { assignee } : {}),
    workspace: req.workspace._id, reporter: req.user._id
  });
  res.status(201).json({ issue });
}

export async function updateIssue(req, res) {
  const allowed = ['title', 'description', 'severity', 'status', 'assignee'];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if (!Object.keys(patch).length) return res.status(400).json({ message: 'No editable issue fields were provided.' });
  if (Object.hasOwn(patch, 'title')) patch.title = requireText(patch.title, 'Issue title', { min: 1, max: 200 });
  if (Object.hasOwn(patch, 'description') && typeof patch.description !== 'string') return res.status(400).json({ message: 'Description must be text.' });
  if (Object.hasOwn(patch, 'description')) patch.description = patch.description.slice(0, 10000);
  if (Object.hasOwn(patch, 'assignee')) patch.assignee = validateAssignee(req.workspace, patch.assignee);
  if (req.workspaceRole === 'member') {
    const existing = await Issue.findOne({ _id: req.params.id, workspace: req.workspace._id }).select('reporter assignee');
    if (!existing) return res.status(404).json({ message: 'Issue not found.' });
    if (String(existing.reporter || '') !== String(req.user._id) && String(existing.assignee || '') !== String(req.user._id)) return res.status(403).json({ message: 'Members can update issues they reported or are assigned to.' });
  }

  const issue = await Issue.findOneAndUpdate(
    { _id: req.params.id, workspace: req.workspace._id },
    { $set: patch }, { new: true, runValidators: true }
  );
  if (!issue) return res.status(404).json({ message: 'Issue not found.' });
  res.json({ issue });
}

export async function listMilestones(req, res) {
  const milestones = await Milestone.find({ workspace: req.workspace._id })
    .populate('project', 'name').sort({ dueDate: 1 }).limit(200);
  res.json({ milestones });
}

export async function createMilestone(req, res) {
  const body = req.body || {};
  const name = requireText(body.name, 'Milestone name', { min: 1, max: 160 });
  if (!isObjectId(body.project)) return res.status(400).json({ message: 'A valid project is required.' });
  const project = await Project.findOne({ _id: body.project, workspace: req.workspace._id }).select('_id');
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  const item = await Milestone.create({
    name,
    description: typeof body.description === 'string' ? body.description.slice(0, 10000) : '',
    dueDate: body.dueDate || undefined,
    status: body.status,
    project: project._id,
    workspace: req.workspace._id
  });
  res.status(201).json({ milestone: item });
}

export async function updateMilestone(req, res) {
  const allowed = ['name', 'description', 'dueDate', 'status'];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if (!Object.keys(patch).length) return res.status(400).json({ message: 'No editable milestone fields were provided.' });
  if (Object.hasOwn(patch, 'name')) patch.name = requireText(patch.name, 'Milestone name', { min: 1, max: 160 });
  if (Object.hasOwn(patch, 'description')) {
    if (typeof patch.description !== 'string') return res.status(400).json({ message: 'Description must be text.' });
    patch.description = patch.description.slice(0, 10000);
  }
  const item = await Milestone.findOneAndUpdate(
    { _id: req.params.id, workspace: req.workspace._id },
    { $set: patch }, { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: 'Milestone not found.' });
  res.json({ milestone: item });
}

export async function listTime(req, res) {
  const filter = { workspace: req.workspace._id };
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) {
      const from = new Date(req.query.from);
      if (Number.isNaN(from.getTime())) return res.status(400).json({ message: 'Invalid from date.' });
      filter.date.$gte = from;
    }
    if (req.query.to) {
      const to = new Date(req.query.to);
      if (Number.isNaN(to.getTime())) return res.status(400).json({ message: 'Invalid to date.' });
      to.setHours(23, 59, 59, 999);
      filter.date.$lte = to;
    }
    if (filter.date.$gte && filter.date.$lte && filter.date.$gte > filter.date.$lte) {
      return res.status(400).json({ message: 'The from date must be on or before the to date.' });
    }
  }
  if (!['owner', 'admin'].includes(req.workspaceRole)) filter.user = req.user._id;
  const entries = await TimeEntry.find(filter)
    .populate('project', 'name code').populate('task', 'title').populate('user', 'name')
    .sort({ date: -1 }).limit(500);
  res.json({ entries });
}

export async function createTime(req, res) {
  const body = req.body || {};
  const hours = Number(body.hours);
  if (!isObjectId(body.project) || !Number.isFinite(hours) || hours < 0.1 || hours > 24) {
    return res.status(400).json({ message: 'Choose a valid project and enter hours between 0.1 and 24.' });
  }
  const project = await Project.findOne({ _id: body.project, workspace: req.workspace._id }).select('_id');
  if (!project) return res.status(404).json({ message: 'Project not found in this workspace.' });

  let task = null;
  if (body.task) {
    if (!isObjectId(body.task)) return res.status(400).json({ message: 'Invalid task ID.' });
    task = await Task.findOne({ _id: body.task, workspace: req.workspace._id, project: project._id }).select('_id');
    if (!task) return res.status(400).json({ message: 'Task must belong to the selected project and workspace.' });
  }
  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) return res.status(400).json({ message: 'Invalid time-entry date.' });
  if (body.billable !== undefined && typeof body.billable !== 'boolean') return res.status(400).json({ message: 'Billable must be true or false.' });

  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const lockedTimesheet = await Timesheet.exists({
    workspace: req.workspace._id,
    user: req.user._id,
    weekStart,
    status: { $in: ['Submitted', 'Approved'] }
  });
  if (lockedTimesheet) {
    return res.status(409).json({
      message: 'Time entries for this week are locked while the timesheet is submitted or approved.'
    });
  }

  const entry = await TimeEntry.create({
    workspace: req.workspace._id, project: project._id, task: task?._id,
    user: req.user._id, hours, date,
    note: typeof body.note === 'string' ? body.note.slice(0, 2000) : '',
    billable: body.billable ?? true
  });

  if (task) {
    try {
      const update = await Task.updateOne(
        { _id: task._id, workspace: req.workspace._id, project: project._id },
        { $inc: { loggedHours: hours } }
      );
      if (update.matchedCount !== 1) throw new Error('Task could not be updated.');
    } catch (error) {
      await TimeEntry.deleteOne({ _id: entry._id, workspace: req.workspace._id });
      throw error;
    }
  }
  res.status(201).json({ entry });
}

export async function listMembers(req, res) {
  const members = await User.find({
    _id: { $in: req.workspace.members.map((member) => member.user) }
  }).select('name email title');
  res.json({
    members: members.map((user) => ({
      ...user.toObject(),
      role: req.workspace.members.find((member) => String(member.user) === String(user._id))?.role
    }))
  });
}

export async function listNotifications(req, res) {
  const notifications = await Notification.find({
    user: req.user._id, workspace: req.workspace._id
  }).sort({ createdAt: -1 }).limit(30);
  res.json({ notifications });
}

export async function readNotification(req, res) {
  const item = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, workspace: req.workspace._id },
    { $set: { readAt: new Date() } }, { new: true }
  );
  if (!item) return res.status(404).json({ message: 'Notification not found.' });
  res.json({ notification: item });
}

export async function dashboard(req, res) {
  const workspace = req.workspace._id;
  const now = new Date();
  const [projectCount, taskCount, completed, overdue, openIssues, hours, statusCounts, recentTasks] = await Promise.all([
    Project.countDocuments({ workspace, status: { $ne: 'Archived' } }),
    Task.countDocuments({ workspace }),
    Task.countDocuments({ workspace, status: 'Done' }),
    Task.countDocuments({ workspace, status: { $ne: 'Done' }, dueDate: { $lt: now } }),
    Issue.countDocuments({ workspace, status: { $in: ['Open', 'In progress'] } }),
    TimeEntry.aggregate([
      { $match: { workspace } },
      { $group: { _id: null, total: { $sum: '$hours' } } }
    ]),
    Task.aggregate([
      { $match: { workspace } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Task.find({ workspace }).sort({ updatedAt: -1 }).limit(6)
      .populate('assignee', 'name').populate('project', 'name')
  ]);

  const byStatusMap = new Map(statusCounts.map((item) => [item._id, item.count]));
  const byStatus = ['Backlog', 'To do', 'In progress', 'In review', 'Done']
    .map((status) => ({ status, count: byStatusMap.get(status) || 0 }));

  res.json({
    stats: {
      projects: projectCount, tasks: taskCount, completed, overdue, openIssues,
      hours: hours[0]?.total || 0
    },
    byStatus,
    recentTasks
  });
}


export async function workloadAnalytics(req, res) {
  const workspace = req.workspace._id;
  const [members, taskRows, timeRows] = await Promise.all([
    User.find({ _id: { $in: req.workspace.members.map((m) => m.user) } }).select('name email'),
    Task.aggregate([{ $match: { workspace } }, { $group: { _id: '$assignee', assigned: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'Done'] }, 1, 0] } }, estimatedHours: { $sum: '$estimateHours' }, overdue: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'Done'] }, { $lt: ['$dueDate', new Date()] }] }, 1, 0] } } } }]),
    TimeEntry.aggregate([{ $match: { workspace } }, { $group: { _id: '$user', loggedHours: { $sum: '$hours' } } }])
  ]);
  const tasksById = new Map(taskRows.map((r) => [String(r._id || ''), r]));
  const timeById = new Map(timeRows.map((r) => [String(r._id), r.loggedHours]));
  const workload = members.map((member) => { const task = tasksById.get(String(member._id)) || {}; return { user: { id: member._id, name: member.name, email: member.email }, assigned: task.assigned || 0, completed: task.completed || 0, overdue: task.overdue || 0, estimatedHours: task.estimatedHours || 0, loggedHours: timeById.get(String(member._id)) || 0 }; });
  const unassigned = tasksById.get('null') || tasksById.get('') || {};
  res.json({ workload, unassigned: { assigned: unassigned.assigned || 0, completed: unassigned.completed || 0, overdue: unassigned.overdue || 0 } });
}


export async function listActivity(req, res) {
  const tasks = await Task.find({ workspace: req.workspace._id, $or: [{ 'comments.0': { $exists: true } }, { 'activity.0': { $exists: true } }] })
    .populate('project', 'name').populate('assignee', 'name').populate('comments.author', 'name')
    .populate('activity.actor', 'name').sort({ updatedAt: -1 }).limit(50);
  const feed = tasks.flatMap((task) => [
    ...task.comments.map((comment) => ({ type: 'comment', taskId: task._id, taskTitle: task.title, project: task.project?.name, actor: comment.author?.name || 'Team member', message: comment.body, createdAt: comment.createdAt })),
    ...task.activity.map((event) => ({ type: 'activity', taskId: task._id, taskTitle: task.title, project: task.project?.name, actor: event.actor?.name || 'Team member', message: event.detail || event.action, createdAt: event.createdAt }))
  ]).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
  res.json({ activity: feed });
}
