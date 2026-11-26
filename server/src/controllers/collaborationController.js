
import { WorkspaceMessage } from '../models/WorkspaceMessage.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { requireText } from '../utils/validation.js';

const mentionPattern = /@([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

function extractMentionEmails(body) {
  return [...new Set(
    [...String(body).matchAll(mentionPattern)]
      .map(match => match[1].toLowerCase())
  )];
}

export async function listMessages(req, res) {
  const messages = await WorkspaceMessage.find({
    workspace: req.workspace._id
  })
    .populate('author', 'name email')
    .populate('mentions', 'name email')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ messages: messages.reverse() });
}

export async function createMessage(req, res) {
  const body = requireText(req.body?.body, 'Message', {
    min: 1,
    max: 5000
  });

  const emails = extractMentionEmails(body);
  const memberIds = req.workspace.members.map(member => member.user);

  const mentionedUsers = emails.length
    ? await User.find({
        email: { $in: emails },
        _id: { $in: memberIds }
      }).select('_id name email')
    : [];

  const message = await WorkspaceMessage.create({
    workspace: req.workspace._id,
    author: req.user._id,
    body,
    mentions: mentionedUsers.map(user => user._id)
  });

  const recipients = mentionedUsers
    .filter(user => String(user._id) !== String(req.user._id));

  if (recipients.length) {
    await Notification.insertMany(
      recipients.map(user => ({
        user: user._id,
        workspace: req.workspace._id,
        message: `${req.user.name || 'A teammate'} mentioned you in workspace chat.`,
        link: '/collaboration'
      }))
    );
  }

  const populatedMessage = await WorkspaceMessage.findOne({
    _id: message._id,
    workspace: req.workspace._id
  })
    .populate('author', 'name email')
    .populate('mentions', 'name email');

  res.status(201).json({ message: populatedMessage });
}
