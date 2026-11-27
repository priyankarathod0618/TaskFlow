
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

describe('Modal component', () => {
  it('renders the modal title', () => {
    render(<Modal title="Create project" onClose={() => {}} />);

    expect(
      screen.getByRole('heading', { name: 'Create project' })
    ).toBeInTheDocument();
  });

  it('renders its children', () => {
    render(
      <Modal title="Test modal" onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();

    render(<Modal title="Test modal" onClose={onClose} />);

    fireEvent.click(document.querySelector('.icon-btn'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();

    const { container } = render(
      <Modal title="Test modal" onClose={onClose} />
    );

    fireEvent.mouseDown(container.querySelector('.modal-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the modal content is clicked', () => {
    const onClose = vi.fn();

    const { container } = render(
      <Modal title="Test modal" onClose={onClose}>
        <p>Inside modal</p>
      </Modal>
    );

    fireEvent.mouseDown(container.querySelector('.modal'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies the wide class when wide is enabled', () => {
    const { container } = render(
      <Modal title="Wide modal" onClose={() => {}} wide />
    );

    expect(container.querySelector('.modal')).toHaveClass('modal-wide');
  });
});
