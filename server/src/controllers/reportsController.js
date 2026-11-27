
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { User } from '../models/User.js';
import { isObjectId } from '../utils/validation.js';

const STATUSES = ['Backlog', 'To do', 'In progress', 'In review', 'Done'];

function parseReportDate(value, field) {
  if (!value) return null;

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    const error = new Error(`${field} must use YYYY-MM-DD format.`);
    error.status = 400;
    throw error;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    const error = new Error(`${field} must be a valid calendar date.`);
    error.status = 400;
    throw error;
  }

  return date;
}

export async function reports(req, res) {
  const workspace = req.workspace._id;
  const from = parseReportDate(req.query.from, 'Start date');
  const to = parseReportDate(req.query.to, 'End date');

  if (from && to && from > to) {
    return res.status(400).json({
      message: 'Start date must be on or before the end date.'
    });
  }

  let projectId = null;

  if (req.query.project) {
    if (!isObjectId(req.query.project)) {
      return res.status(400).json({ message: 'Invalid project selection.' });
    }

    const project = await Project.findOne({
      _id: req.query.project,
      workspace
    }).select('_id');

    if (!project) {
      return res.status(404).json({ message: 'Project not found in this workspace.' });
    }

    projectId = project._id;
  }

  const taskMatch = {
    workspace,
    ...(projectId ? { project: projectId } : {})
  };

  const timeMatch = {
    workspace,
    ...(projectId ? { project: projectId } : {})
  };

  if (from || to) {
    timeMatch.date = {};
    if (from) timeMatch.date.$gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      timeMatch.date.$lte = end;
    }
  }

  const completionDateMatch = {};
  if (from || to) {
    completionDateMatch['activity.createdAt'] = {};
    if (from) completionDateMatch['activity.createdAt'].$gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      completionDateMatch['activity.createdAt'].$lte = end;
    }
  }

  const now = new Date();

  const [
    taskStats,
    statusRows,
    projectRows,
    memberRows,
    timeByUser,
    timeByProject,
    dailyTimeRows,
    completionRows,
    projects,
    members,
    timeTotals
  ] = await Promise.all([
    Task.aggregate([
      { $match: taskMatch },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Done'] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$status', 'Done'] }, { $ne: ['$dueDate', null] }, { $lt: ['$dueDate', now] }] },
                1,
                0
              ]
            }
          },
          estimatedHours: { $sum: '$estimateHours' }
        }
      }
    ]),
    Task.aggregate([
      { $match: taskMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Task.aggregate([
      { $match: taskMatch },
      {
        $group: {
          _id: '$project',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Done'] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$status', 'Done'] }, { $ne: ['$dueDate', null] }, { $lt: ['$dueDate', now] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]),
    Task.aggregate([
      { $match: taskMatch },
      {
        $group: {
          _id: '$assignee',
          assigned: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Done'] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$status', 'Done'] }, { $ne: ['$dueDate', null] }, { $lt: ['$dueDate', now] }] },
                1,
                0
              ]
            }
          },
          estimatedHours: { $sum: '$estimateHours' }
        }
      }
    ]),
    TimeEntry.aggregate([
      { $match: timeMatch },
      { $group: { _id: '$user', loggedHours: { $sum: '$hours' } } }
    ]),
    TimeEntry.aggregate([
      { $match: timeMatch },
      { $group: { _id: '$project', loggedHours: { $sum: '$hours' }, billableHours: { $sum: { $cond: ['$billable', '$hours', 0] } } } }
    ]),
    TimeEntry.aggregate([
      { $match: timeMatch },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            day: { $dayOfMonth: '$date' }
          },
          hours: { $sum: '$hours' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]),
    Task.aggregate([
      { $match: taskMatch },
      { $unwind: '$activity' },
      { $match: { 'activity.action': 'moved', 'activity.detail': / to Done$/i, ...completionDateMatch } },
      {
        $group: {
          _id: {
            year: { $year: '$activity.createdAt' },
            month: { $month: '$activity.createdAt' },
            day: { $dayOfMonth: '$activity.createdAt' }
          },
          completed: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]),
    Project.find({
      workspace,
      ...(projectId ? { _id: projectId } : {}),
      ...(!projectId ? { status: { $ne: 'Archived' } } : {})
    }).select('name code status color priority dueDate').sort({ name: 1 }),
    User.find({
      _id: { $in: req.workspace.members.map(member => member.user) }
    }).select('name email'),
    TimeEntry.aggregate([
      { $match: timeMatch },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$hours' },
          billableHours: { $sum: { $cond: ['$billable', '$hours', 0] } },
          nonBillableHours: { $sum: { $cond: ['$billable', 0, '$hours'] } }
        }
      }
    ])
  ]);

  const taskSummary = taskStats[0] || {
    total: 0,
    completed: 0,
    overdue: 0,
    estimatedHours: 0
  };

  const statusMap = new Map(statusRows.map(row => [row._id, row.count]));
  const statusDistribution = STATUSES.map(status => ({
    status,
    count: statusMap.get(status) || 0
  }));

  const memberTaskMap = new Map(memberRows.map(row => [String(row._id || ''), row]));
  const memberTimeMap = new Map(timeByUser.map(row => [String(row._id), row.loggedHours]));
  const teamWorkload = members.map(member => {
    const row = memberTaskMap.get(String(member._id)) || {};
    return {
      user: { id: member._id, name: member.name, email: member.email },
      assigned: row.assigned || 0,
      completed: row.completed || 0,
      overdue: row.overdue || 0,
      estimatedHours: row.estimatedHours || 0,
      loggedHours: memberTimeMap.get(String(member._id)) || 0
    };
  });

  const unassigned = memberTaskMap.get('') || {};
  const projectTaskMap = new Map(projectRows.map(row => [String(row._id), row]));
  const projectTimeMap = new Map(timeByProject.map(row => [String(row._id), row]));

  const projectPerformance = projects.map(project => {
    const task = projectTaskMap.get(String(project._id)) || {};
    const time = projectTimeMap.get(String(project._id)) || {};
    const total = task.total || 0;
    const completed = task.completed || 0;

    return {
      id: project._id,
      name: project.name,
      code: project.code,
      status: project.status,
      color: project.color,
      totalTasks: total,
      completedTasks: completed,
      overdueTasks: task.overdue || 0,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      loggedHours: Number((time.loggedHours || 0).toFixed(1)),
      billableHours: Number((time.billableHours || 0).toFixed(1))
    };
  });

  const totals = timeTotals[0] || {
    totalHours: 0,
    billableHours: 0,
    nonBillableHours: 0
  };

  const dateKey = item =>
    `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;

  res.json({
    period: {
      from: req.query.from || null,
      to: req.query.to || null
    },
    summary: {
      projects: projects.length,
      tasks: taskSummary.total,
      completed: taskSummary.completed,
      overdue: taskSummary.overdue,
      completionRate: taskSummary.total
        ? Math.round((taskSummary.completed / taskSummary.total) * 100)
        : 0,
      estimatedHours: Number((taskSummary.estimatedHours || 0).toFixed(1)),
      loggedHours: Number((totals.totalHours || 0).toFixed(1)),
      billableHours: Number((totals.billableHours || 0).toFixed(1)),
      nonBillableHours: Number((totals.nonBillableHours || 0).toFixed(1))
    },
    statusDistribution,
    teamWorkload,
    unassigned: {
      assigned: unassigned.assigned || 0,
      completed: unassigned.completed || 0,
      overdue: unassigned.overdue || 0
    },
    projectPerformance,
    dailyTime: dailyTimeRows.map(row => ({
      date: dateKey(row),
      hours: Number(row.hours.toFixed(1))
    })),
    completionTrend: completionRows.map(row => ({
      date: dateKey(row),
      completed: row.completed
    }))
  });
}
