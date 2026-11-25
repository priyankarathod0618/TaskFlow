
import { useEffect, useState } from 'react';
import {
  Plus, AlertCircle, Flag, Clock3, Users, BarChart3, Bell,
  Settings, FileCheck2, Activity, CalendarDays
} from 'lucide-react';
import { api } from '../../services/api';
import { shortDate } from '../../utils/format';

const config = {
  Issues: { eyebrow: 'QUALITY & RISK', title: 'Issues', desc: 'Capture blockers, track severity and move resolution forward.', icon: AlertCircle },
  Milestones: { eyebrow: 'DELIVERY PLAN', title: 'Milestones & phases', desc: 'Make important checkpoints visible across your projects.', icon: Flag },
  'Time logs': { eyebrow: 'EFFORT TRACKING', title: 'Time logs', desc: 'Record effort against the work your team delivers.', icon: Clock3 },
  Timesheets: { eyebrow: 'EFFORT REVIEW', title: 'Timesheets', desc: 'Review logged time and understand where capacity goes.', icon: CalendarDays },
  Team: { eyebrow: 'PEOPLE & ACCESS', title: 'Team', desc: 'Manage workspace members, roles and invitations.', icon: Users },
  Reports: { eyebrow: 'WORKSPACE INSIGHTS', title: 'Reports', desc: 'Understand delivery, task flow and team workload.', icon: BarChart3 },
  Notifications: { eyebrow: 'WORKSPACE UPDATES', title: 'Notifications', desc: 'Keep up with assignments and activity that needs your attention.', icon: Bell },
  Settings: { eyebrow: 'PREFERENCES', title: 'Settings', desc: 'Workspace settings and account preferences.', icon: Settings },
  Approvals: { eyebrow: 'GOVERNANCE', title: 'Approvals', desc: 'A dedicated place for decisions and sign-offs.', icon: FileCheck2 },
  Activity: { eyebrow: 'AUDIT TRAIL', title: 'Activity', desc: 'Follow changes across the workspace.', icon: Activity },
  Collaboration: { eyebrow: 'TEAM DISCUSSION', title: 'Collaboration', desc: 'A shared feed of task discussions, comments and delivery activity.', icon: Activity }
};

export default function GenericPages({ page, onCreate }) {
  const c = config[page] || config.Reports;

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [workload, setWorkload] = useState([]);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [acceptMessage, setAcceptMessage] = useState('');
  const [invitations, setInvitations] = useState([]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteToken, setInviteToken] = useState('');
  const [teamMessage, setTeamMessage] = useState('');

  async function loadTeam() {
    const [membersData, invitationsData] = await Promise.all([
      api('/members'),
      api('/workspaces/invitations')
    ]);

    setItems((membersData.members || []).map(m => ({
      ...m.user,
      role: m.role
    })));

    setInvitations(invitationsData.invitations || []);
  }

  useEffect(() => {
    setError('');

    const path = {
      Issues: '/issues',
      Milestones: '/milestones',
      'Time logs': '/time-entries',
      Timesheets: '/time-entries',
      Team: '/members',
      Notifications: '/notifications',
      Reports: '/dashboard',
      Collaboration: '/activity'
    }[page];

    if (page === 'Team') {
      loadTeam().catch(e => setError(e.message));
    } else if (path) {
      api(path)
        .then(d => {
          const records =
            d.issues || d.milestones || d.entries ||
            d.notifications || d.activity || [];

          setItems(records);
          if (d.stats) setStats(d);
        })
        .catch(e => setError(e.message));
    }

    if (page === 'Reports') {
      api('/analytics/workload')
        .then(d => setWorkload(d.workload || []))
        .catch(e => setError(e.message));
    }
  }, [page]);

  async function sendInvite(e) {
    e.preventDefault();
    setError('');
    setTeamMessage('');
    setInviteToken('');

    try {
      const d = await api('/workspaces/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole
        })
      });

      setInviteToken(d.invitation.token);
      setTeamMessage(`Invitation created for ${inviteEmail}. Share the token below.`);
      setInviteEmail('');
      await loadTeam();
    } catch (e) {
      setError(e.message);
    }
  }

  async function updateRole(userId, role) {
    setError('');
    setTeamMessage('');

    try {
      await api(`/workspaces/members/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
      });

      setTeamMessage('Member role updated successfully.');
      await loadTeam();
    } catch (e) {
      setError(e.message);
      await loadTeam().catch(() => {});
    }
  }

  async function removeMember(userId, name) {
    if (!window.confirm(`Remove ${name || 'this member'} from this workspace?`)) {
      return;
    }

    setError('');
    try {
      await api(`/workspaces/members/${userId}`, {
        method: 'DELETE'
      });

      setTeamMessage('Member removed successfully.');
      await loadTeam();
    } catch (e) {
      setError(e.message);
    }
  }

  async function acceptInvite(e) {
    e.preventDefault();
    setAcceptMessage('');

    try {
      const d = await api('/workspaces/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token })
      });

      setAcceptMessage(`Joined ${d.workspace.name}. Switch workspace from the sidebar.`);
      setToken('');
    } catch (e) {
      setAcceptMessage(e.message);
    }
  }

  async function revokeInvite(id) {
    try {
      await api(`/workspaces/invitations/${id}`, {
        method: 'DELETE'
      });

      setInvitations(v => v.filter(x => x._id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function markRead(id) {
    try {
      const d = await api(`/notifications/${id}/read`, {
        method: 'PATCH'
      });

      setItems(v => v.map(x =>
        x._id === id ? d.notification : x
      ));
    } catch (e) {
      setError(e.message);
    }
  }

  const rows = items.map(x => ({
    title: x.actor || x.title || x.name || x.message || x.note || 'Workspace member',
    sub: x.taskTitle
      ? `${x.taskTitle} · ${x.project || 'Project'} — ${x.message || ''}`
      : (x.project?.name || x.email || x.description || x.role || x.status || ''),
    date: shortDate(x.dueDate || x.date || x.createdAt),
    status: x.status || x.severity || x.type || '',
    hours: x.hours
  }));

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{c.eyebrow}</p>
          <h1>{c.title}</h1>
          <p className="muted">{c.desc}</p>
        </div>

        {['Issues', 'Milestones', 'Time logs'].includes(page) && (
          <button className="btn btn-primary" onClick={onCreate}>
            <Plus size={16} />
            {page === 'Time logs'
              ? 'Log time'
              : `New ${page === 'Issues' ? 'issue' : 'milestone'}`}
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {page === 'Team' && (
        <>
          {teamMessage && (
            <div className="panel" style={{ padding: 14, marginBottom: 16 }}>
              {teamMessage}
            </div>
          )}

          <div className="panel table-panel">
            <div className="panel-head">
              <div>
                <h2>Workspace members</h2>
                <p>{items.length} current members</p>
              </div>
            </div>

            {items.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(m => (
                    <tr key={m._id}>
                      <td><b>{m.name}</b></td>
                      <td>{m.email}</td>
                      <td>
                        <span className={`status-pill role-${String(m.role || 'member').toLowerCase()}`}>
                          {m.role || 'member'}
                        </span>
                      </td>
                      <td>
                        {m.role !== 'owner' ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <select
                              value={m.role || 'member'}
                              onChange={e => updateRole(m._id, e.target.value)}
                              aria-label={`Change role for ${m.name}`}
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>

                            <button
                              className="btn btn-ghost"
                              onClick={() => removeMember(m._id, m.name)}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <span className="muted">Workspace owner</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No members found.</div>
            )}
          </div>

          <div className="panel" style={{ padding: 20, marginTop: 18 }}>
            <h2>Invite a member</h2>
            <p className="muted">
              Invite an existing TaskFlow user to this workspace.
            </p>

            <form className="form-stack" onSubmit={sendInvite}>
              <label>
                Email address
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                  placeholder="member@example.com"
                />
              </label>

              <label>
                Workspace role
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>

              <button className="btn btn-primary">
                Send invitation
              </button>
            </form>

            {inviteToken && (
              <div style={{ marginTop: 16 }}>
                <p><b>Invitation token</b></p>
                <code style={{ overflowWrap: 'anywhere' }}>
                  {inviteToken}
                </code>
                <button
                  className="btn btn-ghost"
                  style={{ marginLeft: 10 }}
                  onClick={() => navigator.clipboard.writeText(inviteToken)}
                >
                  Copy token
                </button>
                <p className="muted">
                  Share this token securely with the invited user. It expires in seven days.
                </p>
              </div>
            )}
          </div>

          <div className="panel" style={{ padding: 20, marginTop: 18 }}>
            <h2>Accept an invitation</h2>
            <form className="form-stack" onSubmit={acceptInvite}>
              <label>
                One-time invitation token
                <input
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  required
                  placeholder="Paste the invitation token"
                />
              </label>
              <button className="btn btn-primary">Join workspace</button>
              {acceptMessage && <p className="muted">{acceptMessage}</p>}
            </form>
          </div>

          <div className="panel" style={{ padding: 20, marginTop: 18 }}>
            <h2>Pending invitations</h2>

            {invitations.length ? invitations.map(inv => (
              <div
                className="panel"
                key={inv._id}
                style={{ padding: 12, marginTop: 8 }}
              >
                <b>{inv.email}</b>
                <p>{inv.role} · expires {shortDate(inv.expiresAt)}</p>
                <button
                  className="btn btn-ghost"
                  onClick={() => revokeInvite(inv._id)}
                >
                  Revoke
                </button>
              </div>
            )) : (
              <p className="muted">
                No active invitations or you do not have permission to view them.
              </p>
            )}
          </div>
        </>
      )}

      {page === 'Reports' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <small>Projects</small>
              <strong>{stats?.stats?.projects ?? '—'}</strong>
              <span className="stat-note">Active portfolio</span>
            </div>
            <div className="stat-card">
              <small>Tasks</small>
              <strong>{stats?.stats?.tasks ?? '—'}</strong>
              <span className="stat-note">Tracked work items</span>
            </div>
            <div className="stat-card">
              <small>Completed</small>
              <strong>{stats?.stats?.completed ?? '—'}</strong>
              <span className="stat-note">Delivered tasks</span>
            </div>
            <div className="stat-card">
              <small>Overdue</small>
              <strong>{stats?.stats?.overdue ?? '—'}</strong>
              <span className="stat-note">Need attention</span>
            </div>
          </div>

          <div className="panel report-panel">
            <h2>Task distribution</h2>
            <p className="muted">Current workflow distribution based on persisted task records.</p>
            <div className="report-bars">
              {(stats?.byStatus || []).map(x => (
                <div key={x.status}>
                  <span>{x.status}</span>
                  <div className="progress-track">
                    <i style={{
                      width: `${stats?.stats?.tasks ? x.count / stats.stats.tasks * 100 : 0}%`
                    }} />
                  </div>
                  <b>{x.count}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="panel table-panel">
            <div className="panel-head">
              <div>
                <h2>Team workload</h2>
                <p>Assigned tasks, completion, overdue work and logged effort</p>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Assigned</th>
                  <th>Completed</th>
                  <th>Overdue</th>
                  <th>Estimate</th>
                  <th>Logged</th>
                </tr>
              </thead>
              <tbody>
                {workload.map(w => (
                  <tr key={w.user.id}>
                    <td>
                      <b>{w.user.name}</b>
                      <small>{w.user.email}</small>
                    </td>
                    <td>{w.assigned}</td>
                    <td>{w.completed}</td>
                    <td>{w.overdue}</td>
                    <td>{w.estimatedHours} h</td>
                    <td>{w.loggedHours} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!['Team', 'Reports'].includes(page) && (
        <div className="panel table-panel">
          <div className="panel-head">
            <div>
              <h2>{page} overview</h2>
              <p>{items.length} records</p>
            </div>
          </div>

          {rows.length ? (
            <table>
              <thead>
                <tr>
                  <th>{page === 'Collaboration' ? 'Contributor' : 'Name / title'}</th>
                  <th>{page === 'Collaboration' ? 'Discussion / task' : 'Details'}</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Effort</th>
                  {page === 'Notifications' && <th>Read</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><b>{r.title}</b></td>
                    <td>{r.sub}</td>
                    <td><span className="status-pill">{r.status || '—'}</span></td>
                    <td>{r.date}</td>
                    <td>{r.hours ? `${r.hours} h` : '—'}</td>
                    {page === 'Notifications' && (
                      <td>
                        {items[i]?.readAt ? 'Read' : (
                          <button
                            className="btn btn-ghost"
                            onClick={() => markRead(items[i]._id)}
                          >
                            Mark read
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <c.icon size={28} />
              <b>No {page.toLowerCase()} to show yet</b>
              <p>As your team creates work and records progress, it will appear here.</p>
              {['Issues', 'Milestones', 'Time logs'].includes(page) && (
                <button className="btn btn-primary" onClick={onCreate}>
                  Create first record
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
