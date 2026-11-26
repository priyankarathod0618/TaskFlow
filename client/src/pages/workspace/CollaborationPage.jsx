
import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Send, Users, RefreshCw, AtSign, Activity } from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import { api } from '../../services/api';
import { shortDate } from '../../utils/format';

function getMentionQuery(value) {
  const match = value.match(/(?:^|\s)@([^\s@]*)$/);
  return match ? match[1].toLowerCase() : null;
}

export default function CollaborationPage({ workspaceRole }) {
  const [messages, setMessages] = useState([]);
  const [activities, setActivities] = useState([]);
  const [members, setMembers] = useState([]);
  const [body, setBody] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const canPost = workspaceRole !== 'viewer';

  async function loadConversation(showLoading = false) {
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const [messageData, memberData, activityData] = await Promise.all([
        api('/collaboration/messages'),
        api('/members'),
        api('/activity')
      ]);

      setMessages(messageData.messages || []);
      setMembers(memberData.members || []);
      setActivities(activityData.activity || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadConversation(true);
    const interval = window.setInterval(() => {
      loadConversation(false);
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];

    return members
      .filter(member => {
        const name = (member.name || '').toLowerCase();
        const email = (member.email || '').toLowerCase();
        return name.includes(mentionQuery) || email.includes(mentionQuery);
      })
      .slice(0, 6);
  }, [members, mentionQuery]);

  function changeBody(value) {
    setBody(value);
    setMentionQuery(getMentionQuery(value));
  }

  function insertMention(member) {
    setBody(value =>
      value.replace(/(?:^|\s)@([^\s@]*)$/, match => {
        const prefix = match.startsWith(' ') ? ' ' : '';
        return `${prefix}@${member.email} `;
      })
    );
    setMentionQuery(null);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!body.trim() || sending) return;

    setSending(true);
    setError('');

    try {
      const data = await api('/collaboration/messages', {
        method: 'POST',
        body: JSON.stringify({ body: body.trim() })
      });

      setMessages(current => [...current, data.message]);
      setBody('');
      setMentionQuery(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="collaboration-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">TEAM DISCUSSION</p>
          <h1>Collaboration</h1>
          <p className="muted">Share updates, ask questions and keep your workspace conversation in one place.</p>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => loadConversation(false)}
          disabled={refreshing}
        >
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="collaboration-grid">
        <section className="panel collaboration-chat">
          <div className="collaboration-panel-head">
            <div className="collaboration-panel-icon"><MessageSquare size={18} /></div>
            <div>
              <h2>Workspace chat</h2>
              <p>{members.length} workspace members · refreshes every 15 seconds</p>
            </div>
            <span className="collaboration-live"><i /> Shared</span>
          </div>

          <div className="collaboration-messages">
            {loading ? (
              <div className="empty-state">Loading conversation…</div>
            ) : messages.length ? (
              messages.map(message => (
                <article className="chat-message" key={message._id}>
                  <Avatar name={message.author?.name || 'Team member'} />
                  <div className="chat-message-content">
                    <div className="chat-message-meta">
                      <b>{message.author?.name || 'Team member'}</b>
                      <span>{new Date(message.createdAt).toLocaleString()}</span>
                    </div>
                    <p>{message.body}</p>
                    {message.mentions?.length > 0 && (
                      <div className="chat-mentions">
                        <AtSign size={12} />
                        {message.mentions.map(person => person.name).join(', ')}
                      </div>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <MessageSquare size={28} />
                <b>Start the conversation</b>
                <p>Post the first message for your workspace.</p>
              </div>
            )}
          </div>

          {canPost ? (
            <form className="collaboration-composer" onSubmit={sendMessage}>
              {mentionCandidates.length > 0 && (
                <div className="mention-suggestions">
                  <span className="mention-suggestions-label">Mention a teammate</span>
                  {mentionCandidates.map(member => (
                    <button
                      type="button"
                      key={member._id}
                      onClick={() => insertMention(member)}
                    >
                      <Avatar name={member.name} size="sm" />
                      <span>
                        <b>{member.name}</b>
                        <small>{member.email}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <textarea
                value={body}
                onChange={e => changeBody(e.target.value)}
                placeholder="Write a message… Type @ to mention a teammate."
                rows="3"
                maxLength="5000"
                required
              />

              <div className="collaboration-composer-footer">
                <small>Use @ and choose a teammate to notify them.</small>
                <button className="btn btn-primary" disabled={sending || !body.trim()}>
                  <Send size={15} />
                  {sending ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          ) : (
            <div className="collaboration-readonly-note">
              You have read-only access to this workspace conversation.
            </div>
          )}
        </section>

        <aside className="panel collaboration-sidebar">
          <div className="collaboration-panel-head">
            <div className="collaboration-panel-icon"><Users size={18} /></div>
            <div>
              <h2>Workspace members</h2>
              <p>{members.length} people in this workspace</p>
            </div>
          </div>

          <div className="collaboration-member-list">
            {members.map(member => (
              <div className="collaboration-member" key={member._id}>
                <Avatar name={member.name} />
                <span>
                  <b>{member.name}</b>
                  <small>{member.email}</small>
                </span>
                <em>{member.role}</em>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className="panel collaboration-activity">
        <div className="collaboration-panel-head">
          <div className="collaboration-panel-icon"><Activity size={18} /></div>
          <div>
            <h2>Recent task activity</h2>
            <p>Comments and updates from across your workspace</p>
          </div>
        </div>

        {activities.length ? (
          <div className="collaboration-activity-list">
            {activities.slice(0, 12).map((item, index) => (
              <div
                className="collaboration-activity-item"
                key={`${item.taskId}-${item.createdAt}-${index}`}
              >
                <span className="activity-dot" />
                <div>
                  <b>{item.actor}</b>
                  <p>{item.message}</p>
                  <small>
                    {item.taskTitle}
                    {item.project ? ` · ${item.project}` : ''}
                    {' · '}
                    {shortDate(item.createdAt)}
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted collaboration-no-activity">
            Task comments and updates will appear here.
          </p>
        )}
      </section>
    </div>
  );
}
