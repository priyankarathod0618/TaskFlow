
import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  CalendarDays,
  MessageSquare,
  GripVertical,
  Lock,
  GitBranch,
  Trash2
} from 'lucide-react';

import { api } from '../../services/api';
import Avatar from '../../components/common/Avatar';
import { shortDate } from '../../utils/format';

const statuses = [
  'Backlog',
  'To do',
  'In progress',
  'In review',
  'Done'
];

function getDateKey(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function getTodayKey() {
  return getDateKey(new Date());
}

function getDateAfterDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getDateKey(date);
}

export default function TasksPage({
  onCreate,
  onEdit,
  projectFilter,
  workspaceRole
}) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState('board');

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [dueDateFilter, setDueDateFilter] = useState('All');

  const [error, setError] = useState('');

  // Only workspace owners and admins can delete tasks.
  const canDeleteTask = ['owner', 'admin'].includes(workspaceRole);

  async function load() {
    try {
      const [t, p] = await Promise.all([
        api('/tasks' + (projectFilter ? `?project=${projectFilter}` : '')),
        api('/projects')
      ]);

      setTasks(t.tasks || []);
      setProjects(p.projects || []);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [projectFilter]);

  async function move(task, status) {
    try {
      await api(`/tasks/${task._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      load();
    } catch (e) {
      setError(e.message);
    }
  }

  // Delete a task after confirmation.
  async function deleteTask(task) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${task.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await api(`/tasks/${task._id}`, {
        method: 'DELETE'
      });

      setTasks(current =>
        current.filter(item => item._id !== task._id)
      );

      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  const tasksById = new Map(
    tasks.map(task => [String(task._id), task])
  );

  // Resolve unfinished dependencies.
  function getBlockedDependencies(task) {
    return (task.dependencies || [])
      .map(dependency => {
        if (typeof dependency === 'object' && dependency !== null) {
          return dependency;
        }

        return tasksById.get(String(dependency));
      })
      .filter(dependency => dependency && dependency.status !== 'Done');
  }

  // Resolve a task's parent.
  function getParentTask(task) {
    if (!task.parentTask) return null;

    if (typeof task.parentTask === 'object') {
      return task.parentTask;
    }

    return tasksById.get(String(task.parentTask)) || null;
  }

  // Find all subtasks belonging to a task.
  function getSubtasks(task) {
    return tasks.filter(child => {
      if (!child.parentTask) return false;

      const parentId =
        typeof child.parentTask === 'object'
          ? child.parentTask._id
          : child.parentTask;

      return String(parentId) === String(task._id);
    });
  }

  // Build assignee filter options.
  const assignees = [
    ...new Map(
      tasks
        .filter(task => task.assignee?._id)
        .map(task => [
          String(task.assignee._id),
          task.assignee
        ])
    ).values()
  ];

  const today = getTodayKey();
  const sevenDaysFromNow = getDateAfterDays(7);

  // Apply all filters together.
  const visible = tasks.filter(task => {
    const matchesSearch = (
      task.title || ''
    ).toLowerCase().includes(query.toLowerCase());

    const matchesPriority =
      filter === 'All' || task.priority === filter;

    const matchesStatus =
      statusFilter === 'All' || task.status === statusFilter;

    const assigneeId = task.assignee?._id
      ? String(task.assignee._id)
      : '';

    const matchesAssignee =
      assigneeFilter === 'All' ||
      (
        assigneeFilter === 'Unassigned'
          ? !assigneeId
          : assigneeId === assigneeFilter
      );

    const dueDate = getDateKey(task.dueDate);

    let matchesDueDate = true;

    if (dueDateFilter === 'Overdue') {
      matchesDueDate = Boolean(
        dueDate && dueDate < today && task.status !== 'Done'
      );
    } else if (dueDateFilter === 'Upcoming') {
      matchesDueDate = Boolean(
        dueDate &&
        dueDate >= today &&
        dueDate <= sevenDaysFromNow &&
        task.status !== 'Done'
      );
    } else if (dueDateFilter === 'No due date') {
      matchesDueDate = !task.dueDate;
    }

    return (
      matchesSearch &&
      matchesPriority &&
      matchesStatus &&
      matchesAssignee &&
      matchesDueDate
    );
  });

  function clearFilters() {
    setQuery('');
    setFilter('All');
    setStatusFilter('All');
    setAssigneeFilter('All');
    setDueDateFilter('All');
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORK MANAGEMENT</p>
          <h1>Tasks</h1>
          <p className="muted">
            Turn plans into progress, one clear next step at a time.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={onCreate}
        >
          <Plus size={16} /> New task
        </button>
      </div>

      {error && (
        <div className="error-banner">{error}</div>
      )}

      <div className="toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Find a task…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="All">All priorities</option>
          {['Low', 'Medium', 'High', 'Urgent'].map(x => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="All">All statuses</option>
          {statuses.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        <select
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value)}
        >
          <option value="All">All assignees</option>
          <option value="Unassigned">Unassigned</option>
          {assignees.map(person => (
            <option
              key={person._id}
              value={String(person._id)}
            >
              {person.name || person.email}
            </option>
          ))}
        </select>

        <select
          value={dueDateFilter}
          onChange={e => setDueDateFilter(e.target.value)}
        >
          <option value="All">All due dates</option>
          <option value="Overdue">Overdue</option>
          <option value="Upcoming">Upcoming (7 days)</option>
          <option value="No due date">No due date</option>
        </select>

        <button
          className="btn btn-secondary"
          onClick={clearFilters}
        >
          Clear filters
        </button>

        <div className="view-switch">
          <button
            className={view === 'board' ? 'selected' : ''}
            onClick={() => setView('board')}
          >
            <LayoutGrid size={16} /> Board
          </button>

          <button
            className={view === 'list' ? 'selected' : ''}
            onClick={() => setView('list')}
          >
            <List size={16} /> List
          </button>
        </div>
      </div>

      <p className="muted">
        Showing {visible.length} of {tasks.length} tasks
      </p>

      {view === 'board' ? (
        <div className="kanban">
          {statuses.map(status => (
            <div
              className="kanban-column"
              key={status}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                const id = e.dataTransfer.getData('task');
                const task = tasks.find(t => t._id === id);

                if (task) move(task, status);
              }}
            >
              <div className="kanban-head">
                <span>
                  <i
                    className={`status-dot dot-${statuses.indexOf(status)}`}
                  />
                  {status}
                </span>

                <b>
                  {visible.filter(t => t.status === status).length}
                </b>

                <button
                  className="icon-btn small"
                  onClick={onCreate}
                >
                  <Plus size={15} />
                </button>
              </div>

              {visible
                .filter(t => t.status === status)
                .map(t => {
                  const blockedDependencies = getBlockedDependencies(t);
                  const parent = getParentTask(t);
                  const subtasks = getSubtasks(t);

                  return (
                    <article
                      className="task-card"
                      key={t._id}
                      draggable
                      onDragStart={e =>
                        e.dataTransfer.setData('task', t._id)
                      }
                      onClick={() => onEdit(t)}
                    >
                      <div className="task-card-top">
                        <span
                          className={`priority ${t.priority?.toLowerCase()}`}
                        >
                          {t.priority}
                        </span>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          {canDeleteTask && (
                            <button
                              className="icon-btn small"
                              title="Delete task"
                              onClick={e => {
                                e.stopPropagation();
                                deleteTask(t);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}

                          <GripVertical
                            size={15}
                            className="grip"
                          />
                        </div>
                      </div>

                      <b>{t.title}</b>

                      <p>
                        {t.description || 'No additional details'}
                      </p>

                      {parent && (
                        <div
                          className="subtask-indicator"
                          title={`Parent task: ${parent.title}`}
                        >
                          <GitBranch size={13} />
                          <span>Subtask of: {parent.title}</span>
                        </div>
                      )}

                      {subtasks.length > 0 && (
                        <div className="subtask-indicator">
                          <GitBranch size={13} />
                          <span>
                            {subtasks.length}{' '}
                            {subtasks.length === 1 ? 'subtask' : 'subtasks'}
                          </span>
                        </div>
                      )}

                      {blockedDependencies.length > 0 && (
                        <div
                          className="blocked-task"
                          title={`Waiting for: ${blockedDependencies
                            .map(dep => dep.title)
                            .join(', ')}`}
                        >
                          <Lock size={13} />
                          <span>
                            Blocked by {blockedDependencies.length}{' '}
                            {blockedDependencies.length === 1
                              ? 'task'
                              : 'tasks'}
                          </span>
                        </div>
                      )}

                      <div className="task-card-meta">
                        <span>
                          <CalendarDays size={13} />
                          {shortDate(t.dueDate)}
                        </span>

                        <span>
                          <MessageSquare size={13} />
                          {t.comments?.length || 0}
                        </span>

                        <Avatar
                          name={t.assignee?.name || 'Unassigned'}
                          size="sm"
                        />
                      </div>
                    </article>
                  );
                })}

              {!visible.some(t => t.status === status) && (
                <div className="column-empty">
                  No matching tasks
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due date</th>
                <th>Assignee</th>
              </tr>
            </thead>

            <tbody>
              {visible.map(t => {
                const blockedDependencies = getBlockedDependencies(t);
                const parent = getParentTask(t);
                const subtasks = getSubtasks(t);

                return (
                  <tr
                    key={t._id}
                    onClick={() => onEdit(t)}
                  >
                    <td>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}>
                        <b>{t.title}</b>

                        {canDeleteTask && (
                          <button
                            className="icon-btn small"
                            title="Delete task"
                            onClick={e => {
                              e.stopPropagation();
                              deleteTask(t);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <small>{t.description}</small>

                      {parent && (
                        <small className="subtask-indicator">
                          <GitBranch size={12} />
                          Subtask of: {parent.title}
                        </small>
                      )}

                      {subtasks.length > 0 && (
                        <small className="subtask-indicator">
                          <GitBranch size={12} />
                          {subtasks.length}{' '}
                          {subtasks.length === 1 ? 'subtask' : 'subtasks'}
                        </small>
                      )}

                      {blockedDependencies.length > 0 && (
                        <small className="blocked-task">
                          <Lock size={12} />
                          Blocked by:{' '}
                          {blockedDependencies
                            .map(dep => dep.title)
                            .join(', ')}
                        </small>
                      )}
                    </td>

                    <td>
                      {projects.find(
                        p => p._id === (t.project?._id || t.project)
                      )?.name || '—'}
                    </td>

                    <td>
                      <span
                        className={`priority ${t.priority?.toLowerCase()}`}
                      >
                        {t.priority}
                      </span>
                    </td>

                    <td>
                      <span className="status-pill">
                        {t.status}
                      </span>
                    </td>

                    <td>{shortDate(t.dueDate)}</td>

                    <td>
                      {t.assignee?.name || 'Unassigned'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!visible.length && (
            <div className="empty-state">
              No tasks match your filters.
            </div>
          )}
        </div>
      )}
    </>
  );
}
