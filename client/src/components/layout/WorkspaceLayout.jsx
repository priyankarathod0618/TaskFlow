
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Clock3,
  FileCheck2,
  Flag,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  Bell,
  Users,
  AlertCircle,
  Plus,
  LogOut,
  PanelLeftClose,
  X
} from 'lucide-react';
import Avatar from '../common/Avatar';

const nav = [
  [
    '',
    [
      ['Home', 'Overview', LayoutDashboard],
      ['Reports', 'Reports', BarChart3],
      ['Projects', 'Projects', FolderKanban],
      ['Users', 'Team', Users],
      ['Collaboration', 'Collaboration', MessageSquare],
      ['My Approvals', 'Approvals', FileCheck2]
    ]
  ],
  [
    'Overview',
    [
      ['Tasks', 'Tasks', CheckSquare],
      ['Issues', 'Issues', AlertCircle],
      ['Phases', 'Milestones', Flag],
      ['Time Logs', 'Time logs', Clock3],
      ['Timesheets', 'Timesheets', CalendarDays]
    ]
  ]
];

export default function WorkspaceLayout({
  user,
  page,
  setPage,
  children,
  onSignOut,
  onCreateProject
}) {
  const [collapsed, setCollapsed] = useState(false);

  const [workspaces, setWorkspaces] = useState([]);
  const [active, setActive] = useState(
    localStorage.getItem('tf_workspace_id') || ''
  );
  const [workspaceError, setWorkspaceError] = useState('');

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchData, setSearchData] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  async function refreshWorkspaces() {
    const d = await api('/workspaces');

    setWorkspaces(d.workspaces || []);

    if (
      !(d.workspaces || []).some(
        w => w.id === localStorage.getItem('tf_workspace_id')
      )
    ) {
      const id = d.workspaces?.[0]?.id || '';

      localStorage.setItem('tf_workspace_id', id);
      setActive(id);
    }
  }

  useEffect(() => {
    refreshWorkspaces().catch(e =>
      setWorkspaceError(e.message)
    );
  }, []);

  async function createWorkspace() {
    const name = window.prompt('Name your new workspace');

    if (!name?.trim()) return;

    try {
      const d = await api('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name })
      });

      await refreshWorkspaces();

      localStorage.setItem('tf_workspace_id', d.workspace.id);
      setActive(d.workspace.id);

      window.location.reload();
    } catch (e) {
      setWorkspaceError(e.message);
    }
  }

  async function openSearch() {
    setSearchOpen(true);
    setSearchQuery('');
    setSearchError('');

    if (searchData.length) return;

    setSearchLoading(true);

    const paths = [
      ['Tasks', '/tasks', 'tasks'],
      ['Projects', '/projects', 'projects'],
      ['Team', '/workspaces/members', 'members']
    ];

    const results = await Promise.allSettled(
      paths.map(async ([type, path, key]) => {
        const data = await api(path);

        return (data[key] || []).map(item => ({
          ...(type === 'Team' && item.user
            ? item.user
            : item),
          role: item.role,
          _kind: type
        }));
      })
    );

    const failed = results.filter(
      x => x.status === 'rejected'
    );

    setSearchData(
      results
        .filter(x => x.status === 'fulfilled')
        .flatMap(x => x.value)
    );

    if (failed.length === paths.length) {
      setSearchError(
        'Search could not load records. Check your connection and try again.'
      );
    }

    setSearchLoading(false);
  }

  function switchWorkspace(id) {
    localStorage.setItem('tf_workspace_id', id);
    setActive(id);
    window.location.reload();
  }

  const current =
    workspaces.find(w => w.id === active) || workspaces[0];

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    if (!q) return [];

    return searchData
      .filter(item =>
        [
          item.title,
          item.name,
          item.code,
          item.email,
          item.description,
          item.status
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 12);
  }, [searchData, searchQuery]);

  useEffect(() => {
    const onKey = e => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 'k'
      ) {
        e.preventDefault();
        openSearch();
      }

      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };

    window.addEventListener('keydown', onKey);

    return () =>
      window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className={`workspace ${
        collapsed ? 'sidebar-collapsed' : ''
      }`}
    >
      <aside className="sidebar">
        <div className="side-brand">
          <span className="brand-mark">
            <CheckSquare size={19} />
          </span>

          {!collapsed && (
            <b>
              taskflow<span>pro</span>
            </b>
          )}

          <button
            className="side-collapse"
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeftClose size={17} />
          </button>
        </div>

        <div className="workspace-switch">
          <span className="workspace-avatar">
            {(current?.name || 'W').slice(0, 1).toUpperCase()}
          </span>

          {!collapsed && (
            <>
              <span className="workspace-switch-select">
                <select
                  aria-label="Select workspace"
                  value={current?.id || ''}
                  onChange={e =>
                    switchWorkspace(e.target.value)
                  }
                >
                  {workspaces.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} · {w.role}
                    </option>
                  ))}
                </select>

                <small>
                  {current?.role || 'Workspace'}
                </small>
              </span>

              <button
                className="icon-btn"
                title="Create workspace"
                onClick={createWorkspace}
              >
                <Plus size={15} />
              </button>
            </>
          )}
        </div>

        {workspaceError && (
          <small className="workspace-error">
            {workspaceError}
          </small>
        )}

        <div className="side-scroll">
          {nav.map(([group, items]) => (
            <div className="nav-group" key={group}>
              {!collapsed && group && (
                <small className="nav-label">
                  {group}
                </small>
              )}

              {items.map(([label, target, Icon]) => (
                <button
                  key={target}
                  className={`side-link ${
                    page === target ? 'active' : ''
                  }`}
                  onClick={() => setPage(target)}
                  title={label}
                >
                  <Icon size={18} />

                  {!collapsed && <span>{label}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="side-bottom">
          <button
            className={`side-link ${
              page === 'Settings' ? 'active' : ''
            }`}
            onClick={() => setPage('Settings')}
          >
            <Settings size={18} />
            {!collapsed && <span>Settings</span>}
          </button>

          <div className="user-card">
            <Avatar name={user?.name || 'User'} />

            {!collapsed && (
              <>
                <span>
                  <b>{user?.name}</b>
                  <small>{user?.email}</small>
                </span>

                <button
                  className="icon-btn"
                  onClick={onSignOut}
                >
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar">
          <div className="crumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>{page}</b>
          </div>

          <div className="top-actions">
            <button
              className="global-search-trigger"
              onClick={openSearch}
              aria-label="Open global search"
            >
              <Search size={17} />
              <span>Search anything...</span>
              <kbd>⌘ K</kbd>
            </button>

            <button
              className="icon-btn"
              onClick={() => setPage('Notifications')}
            >
              <Bell size={18} />
            </button>

            <button className="help-btn">
              <HelpCircle size={17} /> Help
            </button>

            <Avatar name={user?.name || 'User'} />
          </div>
        </header>

        <div className="workspace-content">
          {React.Children.map(children, child =>
            React.isValidElement(child)
              ? React.cloneElement(child, {
                  workspaceRole: current?.role
                })
              : child
          )}
        </div>
      </main>

      {searchOpen && (
        <div
          className="global-search-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) {
              setSearchOpen(false);
            }
          }}
        >
          <section
            className="global-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search workspace"
          >
            <div className="global-search-input">
              <Search size={19} />

              <input
                autoFocus
                value={searchQuery}
                onChange={e =>
                  setSearchQuery(e.target.value)
                }
                placeholder="Search tasks, projects, people..."
              />

              <button
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
              >
                <X size={18} />
              </button>
            </div>

            <div className="global-search-results">
              {searchLoading && (
                <p className="muted">
                  Loading workspace records…
                </p>
              )}

              {searchError && (
                <p className="search-error">
                  {searchError}
                </p>
              )}

              {!searchLoading &&
                !searchError &&
                !searchQuery.trim() && (
                  <p className="muted">
                    Start typing to search tasks, projects and team members.
                  </p>
                )}

              {searchQuery.trim() &&
                !searchLoading &&
                searchResults.length === 0 &&
                !searchError && (
                  <p className="muted">
                    No matching records found.
                  </p>
                )}

              {searchResults.map((item, i) => (
                <button
                  className="global-search-result"
                  key={`${
                    item._kind
                  }-${item._id || item.id || i}`}
                  onClick={() => {
                    setPage(item._kind);
                    setSearchOpen(false);
                  }}
                >
                  <span
                    className={`search-kind ${item._kind.toLowerCase()}`}
                  >
                    {item._kind}
                  </span>

                  <span>
                    <b>
                      {item.title ||
                        item.name ||
                        item.email ||
                        'Untitled'}
                    </b>

                    <small>
                      {item.code ||
                        item.email ||
                        item.role ||
                        item.description ||
                        item.status ||
                        'Open record'}
                    </small>
                  </span>

                  <ChevronRight size={16} />
                </button>
              ))}
            </div>

            <footer>
              <span>
                <kbd>ESC</kbd> close
              </span>
              <span>Search across this workspace</span>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
