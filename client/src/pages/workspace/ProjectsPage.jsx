
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ProjectsPage from './ProjectsPage';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: vi.fn()
}));

const sampleProjects = [
  {
    _id: 'project-1',
    name: 'Website Redesign',
    code: 'WEB',
    description: 'Redesign the company website',
    status: 'Active',
    priority: 'High',
    dueDate: '2026-12-20',
    taskStats: { done: 5, total: 10 }
  },
  {
    _id: 'project-2',
    name: 'Mobile Application',
    code: 'APP',
    description: 'Build a mobile application',
    status: 'Active',
    priority: 'Medium',
    dueDate: '2026-12-25',
    taskStats: { done: 2, total: 8 }
  }
];

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({
      projects: sampleProjects
    });
  });

  it('loads and displays projects', async () => {
    render(<ProjectsPage onCreate={vi.fn()} onOpen={vi.fn()} />);

    expect(
      await screen.findByRole('heading', { name: 'Website Redesign' })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Mobile Application' })
    ).toBeInTheDocument();

    expect(screen.getByText('2 active projects')).toBeInTheDocument();
  });

  it('filters projects using the search input', async () => {
    render(<ProjectsPage onCreate={vi.fn()} onOpen={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Website Redesign' });

    fireEvent.change(screen.getByPlaceholderText('Search projects…'), {
      target: { value: 'Mobile' }
    });

    expect(
      screen.getByRole('heading', { name: 'Mobile Application' })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: 'Website Redesign' })
    ).not.toBeInTheDocument();

    expect(screen.getByText('1 active projects')).toBeInTheDocument();
  });

  it('displays an empty state when no projects exist', async () => {
    vi.mocked(api).mockResolvedValueOnce({ projects: [] });

    render(<ProjectsPage onCreate={vi.fn()} onOpen={vi.fn()} />);

    expect(
      await screen.findByRole('heading', { name: 'No projects found' })
    ).toBeInTheDocument();
  });

  it('calls onCreate when the New project button is clicked', async () => {
    const onCreate = vi.fn();

    render(<ProjectsPage onCreate={onCreate} onOpen={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Website Redesign' });

    fireEvent.click(screen.getByRole('button', { name: /New project/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('passes the selected project to onOpen', async () => {
    const onOpen = vi.fn();

    render(<ProjectsPage onCreate={vi.fn()} onOpen={onOpen} />);

    await screen.findByRole('heading', { name: 'Website Redesign' });

    fireEvent.click(screen.getAllByRole('button', { name: /Open project/i })[0]);

    expect(onOpen).toHaveBeenCalledWith(sampleProjects[0]);
  });
});
