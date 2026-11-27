
import mongoose from 'mongoose';
import { TimeEntry } from '../models/TimeEntry.js';
import { Timesheet } from '../models/Timesheet.js';
import {
  isWorkspaceManager,
  WORKSPACE_ROLE_GROUPS,
  hasWorkspaceRole
} from '../utils/workspacePermissions.js';
import { createNotifications } from '../services/notificationService.js';

function weekBounds(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    const error = new Error('Invalid week date.');
    error.status = 400;
    throw error;
  }

  date.setHours(0, 0, 0, 0);

  const day = (date.getDay() + 6) % 7;
  const start = new Date(date);

  start.setDate(date.getDate() - day);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export async function listTimesheets(req, res) {
  const filter = {
    workspace: req.workspace._id
  };

  if (!isWorkspaceManager(req.workspaceRole)) {
    filter.user = req.user._id;
  }

  if (req.query.status) {
    if (!['Draft', 'Submitted', 'Approved', 'Rejected'].includes(req.query.status)) {
      return res.status(400).json({
        message: 'Invalid timesheet status.'
      });
    }

    filter.status = req.query.status;
  }

  const items = await Timesheet.find(filter)
    .populate('user', 'name email')
    .populate('reviewedBy', 'name')
    .populate({
      path: 'entries',
      populate: [
        { path: 'project', select: 'name code' },
        { path: 'task', select: 'title' }
      ]
    })
    .sort({ weekStart: -1, createdAt: -1 })
    .limit(100);

  res.json({ timesheets: items });
}

export async function submitTimesheet(req, res) {
  if (!hasWorkspaceRole(
    req.workspaceRole,
    WORKSPACE_ROLE_GROUPS.contributors
  )) {
    return res.status(403).json({
      message: 'Viewers cannot submit timesheets.'
    });
  }

  const { start, end } = weekBounds(req.body?.weekStart);

  const entries = await TimeEntry.find({
    workspace: req.workspace._id,
    user: req.user._id,
    date: { $gte: start, $lte: end }
  }).select('_id hours');

  if (!entries.length) {
    return res.status(400).json({
      message: 'Add at least one time log for this week before submitting.'
    });
  }

  const totalHours = entries.reduce(
    (sum, entry) => sum + Number(entry.hours || 0),
    0
  );

  const filter = {
    workspace: req.workspace._id,
    user: req.user._id,
    weekStart: start,
    status: { $ne: 'Approved' }
  };

  let item;

  try {
    item = await Timesheet.findOneAndUpdate(
      filter,
      {
        $set: {
          weekEnd: end,
          entries: entries.map(entry => entry._id),
          totalHours,
          status: 'Submitted',
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: ''
        },
        $push: {
          history: {
            actor: req.user._id,
            action: 'Submitted',
            note: 'Timesheet submitted for review.'
          }
        },
        $setOnInsert: {
          workspace: req.workspace._id,
          user: req.user._id,
          weekStart: start
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    )
      .populate('user', 'name email')
      .populate('entries');
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'This timesheet has already been approved or submitted concurrently. Refresh and try again.'
      });
    }

    throw error;
  }

  if (!item) {
    return res.status(409).json({
      message: 'This timesheet has already been approved and cannot be resubmitted.'
    });
  }

  const approvers = req.workspace.members
    .filter(member =>
      ['owner', 'admin'].includes(member.role) &&
      String(member.user) !== String(req.user._id)
    )
    .map(member => member.user);

  if (approvers.length) {
    await createNotifications({
      userIds: approvers,
      workspaceId: req.workspace._id,
      message: `${req.user.name} submitted a timesheet for review.`,
      link: '/approvals',
      excludeUserIds: [req.user._id]
    });
  }

  res.status(201).json({ timesheet: item });
}

export async function reviewTimesheet(req, res) {
  if (!isWorkspaceManager(req.workspaceRole)) {
    return res.status(403).json({
      message: 'Only workspace owners and admins can review timesheets.'
    });
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      message: 'Invalid timesheet ID.'
    });
  }

  const { decision, note = '' } = req.body || {};

  if (!['Approved', 'Rejected'].includes(decision)) {
    return res.status(400).json({
      message: 'Decision must be Approved or Rejected.'
    });
  }

  if (typeof note !== 'string') {
    return res.status(400).json({
      message: 'Review note must be text.'
    });
  }

  const reviewNote = note.trim().slice(0, 1000);

  const item = await Timesheet.findOneAndUpdate(
    {
      _id: req.params.id,
      workspace: req.workspace._id,
      status: 'Submitted'
    },
    {
      $set: {
        status: decision,
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
        reviewNote
      },
      $push: {
        history: {
          actor: req.user._id,
          action: decision,
          note: reviewNote
        }
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!item) {
    const exists = await Timesheet.exists({
      _id: req.params.id,
      workspace: req.workspace._id
    });

    if (!exists) {
      return res.status(404).json({
        message: 'Timesheet not found.'
      });
    }

    return res.status(409).json({
      message: 'This timesheet has already been reviewed.'
    });
  }

  await item.populate([
    { path: 'user', select: 'name email' },
    { path: 'reviewedBy', select: 'name' }
  ]);

  await createNotifications({
    userIds: [item.user?._id || item.user],
    workspaceId: req.workspace._id,
    message: `Your timesheet was ${decision.toLowerCase()}.`,
    link: '/timesheets',
    excludeUserIds: [req.user._id]
  });

  res.json({ timesheet: item });
}
