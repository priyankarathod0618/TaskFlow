
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import TaskModal from './TaskModal';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: vi.fn()
}));

async function renderTaskModal(props = {}) {
  render(
    <TaskModal
      onClose={vi.fn()}
      onSave={vi.fn()}
      {...props}
    />
  );

  // Wait for the component's asynchronous API requests and state updates.
  await screen.findByRole('option', { name: 'Website Redesign' });
}

describe('TaskModal component', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();

    vi.mocked(api).mockImplementation(async (path) => {
      if (path === '/projects') {
        return {
          projects: [
            { _id: 'project-1', name: 'Website Redesign' }
          ]
        };
      }

      if (path === '/members') {
        return {
          members: [
            {
              _id: 'user-1',
              name: 'John Doe',
              role: 'member'
            }
          ]
        };
      }

      if (path === '/tasks') {
        return { tasks: [] };
      }

      return {};
    });
  });

  it('renders the create task modal', async () => {
    await renderTaskModal();

    expect(
      screen.getByRole('heading', { name: 'Create a task' })
    ).toBeInTheDocument();
  });

  it('loads project options', async () => {
    await renderTaskModal();

    expect(
      screen.getByRole('option', { name: 'Website Redesign' })
    ).toBeInTheDocument();
  });

  it('loads workspace members as assignee options', async () => {
    await renderTaskModal();

    expect(
      screen.getByRole('option', {
        name: 'John Doe · member'
      })
    ).toBeInTheDocument();
  });

  it('submits task details through onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    await renderTaskModal({ onSave });

    fireEvent.change(screen.getByLabelText('Task title'), {
      target: { value: 'Build dashboard' }
    });

    expect(screen.getByLabelText('Project')).toHaveValue('project-1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Create task' })
    );

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Build dashboard',
        project: 'project-1',
        status: 'To do',
        priority: 'Medium',
        estimateHours: 2,
        labels: [],
        dependencies: [],
        parentTask: null
      })
    );
  });

  it('displays update task title when editing an existing task', async () => {
    await renderTaskModal({
      task: {
        _id: 'task-1',
        title: 'Existing task',
        status: 'In progress',
        priority: 'High'
      }
    });

    expect(
      screen.getByRole('heading', { name: 'Update task' })
    ).toBeInTheDocument();

    expect(screen.getByLabelText('Task title')).toHaveValue('Existing task');
  });
});
