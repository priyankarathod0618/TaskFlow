
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  RefreshCw,
  AlertTriangle,
  Users
} from 'lucide-react';
import { api } from '../../services/api';

function localDate(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: localDate(from), to: localDate(to) };
}

function hours(value) {
  return `${Number(value || 0).toFixed(1)} h`;
}

function StatCard({ icon: Icon, label, value, note }) {
  return (
    <div className="stat-card">
      <span className="stat-icon"><Icon size={19} /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <span className="stat-note">{note}</span>
    </div>
  );
}

function BarList({ items, labelKey, valueKey, emptyText, suffix = '' }) {
  const maximum = Math.max(1, ...items.map(item => Number(item[valueKey] || 0)));

  if (!items.length) {
    return <p className="muted" style={{ padding: '18px 0' }}>{emptyText}</p>;
  }

  return (
    <div className="report-bars">
      {items.map(item => (
        <div key={item[labelKey]}>
          <span>{item[labelKey]}</span>
          <div className="progress-track">
            <i style={{ width: `${Math.max(0, Number(item[valueKey] || 0) / maximum * 100)}%` }} />
          </div>
          <b>{Number(item[valueKey] || 0).toFixed(valueKey === 'hours' ? 1 : 0)}{suffix}</b>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const initialRange = useMemo(defaultRange, []);
  const [range, setRange] = useState(initialRange);
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/projects')
      .then(data => setProjects(data.projects || []))
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();
        if (range.from) params.set('from', range.from);
        if (range.to) params.set('to', range.to);
        if (projectId) params.set('project', projectId);

        const data = await api(`/reports?${params.toString()}`);
        if (active) setReport(data);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReport();
    return () => { active = false; };
  }, [range.from, range.to, projectId]);

  const summary = report?.summary || {};
  const dailyTime = report?.dailyTime || [];
  const completionTrend = report?.completionTrend || [];

  const dailyTimeItems = dailyTime.map(item => ({
    ...item,
    label: new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    })
  }));

  const completionItems = completionTrend.map(item => ({
    ...item,
    label: new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    })
  }));

  function changeRange(field, value) {
    setRange(current => ({ ...current, [field]: value }));
  }

  function resetFilters() {
    setRange(defaultRange());
    setProjectId('');
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE INSIGHTS</p>
          <h1>Reports & analytics</h1>
          <p className="muted">Understand delivery, team capacity, project progress and recorded effort.</p>
        </div>
        <button className="btn btn-ghost" onClick={resetFilters}>
          <RefreshCw size={15} /> Reset filters
        </button>
      </div>

      <section className="panel" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'end', flexWrap: 'wrap', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, minWidth: 160 }}>
            <span className="muted">From</span>
            <input type="date" value={range.from} max={range.to || undefined} onChange={e => changeRange('from', e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6, minWidth: 160 }}>
            <span className="muted">To</span>
            <input type="date" value={range.to} min={range.from || undefined} onChange={e => changeRange('to', e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6, minWidth: 220 }}>
            <span className="muted">Project</span>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">All projects</option>
              {projects.map(project => (
                <option key={project._id} value={project._id}>{project.name}</option>
              ))}
            </select>
          </label>
          <span className="muted" style={{ fontSize: 12, paddingBottom: 8 }}>
            Date range filters time logs and completion activity. Workload and project status show current records.
          </span>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      {loading && !report ? (
        <div className="panel empty-state">Loading workspace reports…</div>
      ) : (
        <>
          <div className="stats-grid">
            <StatCard icon={FolderKanban} label="Projects" value={summary.projects ?? '—'} note="Active portfolio" />
            <StatCard icon={CheckCircle2} label="Task completion" value={`${summary.completionRate ?? 0}%`} note={`${summary.completed || 0} of ${summary.tasks || 0} tasks complete`} />
            <StatCard icon={AlertTriangle} label="Overdue tasks" value={summary.overdue ?? '—'} note="Open tasks past their due date" />
            <StatCard icon={Clock3} label="Hours logged" value={hours(summary.loggedHours)} note={`${hours(summary.billableHours)} billable`} />
          </div>

          <div className="dashboard-grid" style={{ marginTop: 18 }}>
            <section className="panel report-panel">
              <div className="panel-head">
                <div>
                  <h2>Task distribution</h2>
                  <p>Current status of tasks in the selected scope</p>
                </div>
              </div>
              <BarList
                items={(report?.statusDistribution || []).map(item => ({ ...item, label: item.status }))}
                labelKey="label"
                valueKey="count"
                emptyText="No task data available for this scope."
              />
            </section>

            <section className="panel report-panel">
              <div className="panel-head">
                <div>
                  <h2>Effort breakdown</h2>
                  <p>Time recorded within the selected date range</p>
                </div>
              </div>
              <div className="pulse-grid">
                <div><small>Total logged</small><b>{hours(summary.loggedHours)}</b><span>All recorded time</span></div>
                <div><small>Billable</small><b>{hours(summary.billableHours)}</b><span>Client / billable effort</span></div>
                <div><small>Non-billable</small><b>{hours(summary.nonBillableHours)}</b><span>Internal effort</span></div>
              </div>
            </section>
          </div>

          <section className="panel report-panel" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <div>
                <h2>Team workload</h2>
                <p>Assigned work, completion, overdue tasks and logged hours per workspace member</p>
              </div>
              <Users size={18} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Assigned</th>
                    <th>Completed</th>
                    <th>Overdue</th>
                    <th>Estimated</th>
                    <th>Logged in period</th>
                  </tr>
                </thead>
                <tbody>
                  {(report?.teamWorkload || []).map(member => (
                    <tr key={member.user.id}>
                      <td><b>{member.user.name}</b><small>{member.user.email}</small></td>
                      <td>{member.assigned}</td>
                      <td>{member.completed}</td>
                      <td>{member.overdue}</td>
                      <td>{hours(member.estimatedHours)}</td>
                      <td>{hours(member.loggedHours)}</td>
                    </tr>
                  ))}
                  {report?.unassigned?.assigned > 0 && (
                    <tr>
                      <td><b>Unassigned</b></td>
                      <td>{report.unassigned.assigned}</td>
                      <td>{report.unassigned.completed}</td>
                      <td>{report.unassigned.overdue}</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {!report?.teamWorkload?.length && !report?.unassigned?.assigned && (
                <p className="muted" style={{ padding: 16 }}>No team workload to report yet.</p>
              )}
            </div>
          </section>

          <section className="panel report-panel" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <div>
                <h2>Project performance</h2>
                <p>Current task completion and selected-period time logged by project</p>
              </div>
            </div>
            {report?.projectPerformance?.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Tasks</th>
                      <th>Overdue</th>
                      <th>Hours logged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.projectPerformance.map(project => (
                      <tr key={project.id}>
                        <td><b>{project.name}</b><small>{project.code || 'Project'}</small></td>
                        <td><span className="status-pill">{project.status}</span></td>
                        <td style={{ minWidth: 150 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <span>{project.completionRate}%</span>
                            <small>{project.completedTasks}/{project.totalTasks}</small>
                          </div>
                          <div className="progress-track"><i style={{ width: `${project.completionRate}%` }} /></div>
                        </td>
                        <td>{project.totalTasks}</td>
                        <td>{project.overdueTasks}</td>
                        <td>{hours(project.loggedHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No active projects found in this workspace.</p>
            )}
          </section>

          <div className="dashboard-grid" style={{ marginTop: 18 }}>
            <section className="panel report-panel">
              <div className="panel-head">
                <div>
                  <h2>Daily time logged</h2>
                  <p>Hours recorded per day in the selected period</p>
                </div>
                <CalendarDays size={18} />
              </div>
              <BarList
                items={dailyTimeItems}
                labelKey="label"
                valueKey="hours"
                emptyText="No time entries in this date range."
                suffix="h"
              />
            </section>

            <section className="panel report-panel">
              <div className="panel-head">
                <div>
                  <h2>Task completion trend</h2>
                  <p>Tasks moved to Done per day in the selected period</p>
                </div>
                <BarChart3 size={18} />
              </div>
              <BarList
                items={completionItems}
                labelKey="label"
                valueKey="completed"
                emptyText="No task completion activity in this date range."
              />
            </section>
          </div>

          {loading && <p className="muted" style={{ marginTop: 12 }}>Updating report filters…</p>}
        </>
      )}
    </>
  );
}
